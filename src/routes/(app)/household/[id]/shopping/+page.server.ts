import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db/client';
import { shoppingCategories, shoppingItems } from '$lib/server/db/schema';
import { eq, and, or, asc, desc, sql, inArray, isNull, isNotNull, ne } from 'drizzle-orm';
import { generateId } from '$lib/server/utils';
import { requireMembership, requireAdmin } from '$lib/server/household';

/**
 * Verify a submitted category belongs to this household.
 *
 * Returns true for null (uncategorised). Without this, an item can be pointed at
 * another household's category: the foreign key only proves the row exists.
 */
async function categoryBelongsToHousehold(categoryId: string | null, householdId: string) {
  if (categoryId === null) return true;
  const rows = await db
    .select({ id: shoppingCategories.id })
    .from(shoppingCategories)
    .where(
      and(eq(shoppingCategories.id, categoryId), eq(shoppingCategories.householdId, householdId))
    )
    .limit(1);
  return rows.length > 0;
}

/** Items a user is allowed to see: everything shared, plus their own private items. */
function visibleToUser(householdId: string, userId: string) {
  return and(
    eq(shoppingItems.householdId, householdId),
    or(eq(shoppingItems.visibility, 'shared'), eq(shoppingItems.addedBy, userId))
  );
}

export const load: PageServerLoad = async ({ locals, params }) => {
  const householdId = params.id;
  const { user } = await requireMembership(locals, householdId);

  const categories = await db
    .select()
    .from(shoppingCategories)
    .where(eq(shoppingCategories.householdId, householdId))
    .orderBy(asc(shoppingCategories.sortOrder), asc(shoppingCategories.name));

  // Unpurchased first (SQLite sorts NULLs first), then newest purchases at the
  // top of the history panel, then most recently added.
  const items = await db
    .select({
      id: shoppingItems.id,
      categoryId: shoppingItems.categoryId,
      visibility: shoppingItems.visibility,
      name: shoppingItems.name,
      quantity: shoppingItems.quantity,
      notes: shoppingItems.notes,
      addedBy: shoppingItems.addedBy,
      purchasedBy: shoppingItems.purchasedBy,
      purchasedAt: shoppingItems.purchasedAt,
      createdAt: shoppingItems.createdAt
    })
    .from(shoppingItems)
    .where(visibleToUser(householdId, user.id))
    .orderBy(
      sql`${shoppingItems.purchasedAt} IS NOT NULL`,
      desc(shoppingItems.purchasedAt),
      desc(shoppingItems.createdAt)
    );

  // Autofill: distinct past item names for this household, ranked by how often
  // they have been added and how recently, each carrying the category last used
  // for that name so picking a suggestion can prefill it.
  //
  // Rolled up in JS rather than SQL. A correlated subquery is the obvious way to
  // fetch "the category last used for this name", but an unqualified outer
  // column reference inside `FROM shopping_items s2` binds to s2, making the
  // join predicate always true and handing every suggestion the same category.
  // Grouping here keeps the correctness obvious and costs nothing: this reads
  // the rows the list already needs.
  const historyRows = await db
    .select({
      name: shoppingItems.name,
      categoryId: shoppingItems.categoryId,
      createdAt: shoppingItems.createdAt
    })
    .from(shoppingItems)
    .where(visibleToUser(householdId, user.id))
    .orderBy(desc(shoppingItems.createdAt))
    .limit(1000);

  const byName = new Map<
    string,
    { name: string; categoryId: string | null; uses: number; lastUsed: number }
  >();
  for (const row of historyRows) {
    // Case-insensitive, so "Milk" and "milk" are one suggestion
    const key = row.name.toLowerCase();
    const created = row.createdAt.getTime();
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, {
        name: row.name,
        categoryId: row.categoryId,
        uses: 1,
        lastUsed: created
      });
      continue;
    }
    existing.uses += 1;
    if (created > existing.lastUsed) {
      existing.name = row.name;
      existing.lastUsed = created;
    }
    // Rows arrive newest-first, so the first categorised one wins
    if (existing.categoryId === null && row.categoryId !== null) {
      existing.categoryId = row.categoryId;
    }
  }

  const suggestions = [...byName.values()]
    .sort((a, b) => b.uses - a.uses || b.lastUsed - a.lastUsed)
    .slice(0, 200)
    .map(({ name, categoryId, uses }) => ({ name, categoryId, uses }));

  return { categories, items, suggestions };
};

export const actions: Actions = {
  addItem: async ({ request, locals, params }) => {
    const householdId = params.id;
    const { user } = await requireMembership(locals, householdId);

    const formData = await request.formData();
    const name = (formData.get('name') as string)?.trim();
    const quantity = (formData.get('quantity') as string)?.trim() || null;
    const notes = (formData.get('notes') as string)?.trim() || null;
    const categoryId = (formData.get('categoryId') as string) || null;
    const visibility = formData.get('visibility') === 'personal' ? 'personal' : 'shared';

    if (!name) {
      return fail(400, { error: 'Item name is required' });
    }

    if (!(await categoryBelongsToHousehold(categoryId, householdId))) {
      return fail(400, { error: 'Unknown category' });
    }

    const now = new Date();
    await db.insert(shoppingItems).values({
      id: generateId(),
      householdId,
      categoryId,
      visibility,
      name,
      quantity,
      notes,
      addedBy: user.id,
      createdAt: now,
      updatedAt: now
    });

    return { success: true };
  },

  updateItem: async ({ request, locals, params }) => {
    const householdId = params.id;
    const { user } = await requireMembership(locals, householdId);

    const formData = await request.formData();
    const itemId = formData.get('itemId') as string;
    const name = (formData.get('name') as string)?.trim();
    const quantity = (formData.get('quantity') as string)?.trim() || null;
    const notes = (formData.get('notes') as string)?.trim() || null;
    const categoryId = (formData.get('categoryId') as string) || null;
    const visibility = formData.get('visibility') === 'personal' ? 'personal' : 'shared';
    const purchased = formData.get('purchased') === 'true';

    if (!itemId || !name) {
      return fail(400, { error: 'Item name is required' });
    }

    if (!(await categoryBelongsToHousehold(categoryId, householdId))) {
      return fail(400, { error: 'Unknown category' });
    }

    // Read the current row first: purchasedAt/By are only rewritten when the
    // purchased state actually changed, so editing a note doesn't reassign who
    // bought it or when.
    const existing = await db
      .select({
        purchasedAt: shoppingItems.purchasedAt,
        purchasedBy: shoppingItems.purchasedBy,
        visibility: shoppingItems.visibility,
        addedBy: shoppingItems.addedBy
      })
      .from(shoppingItems)
      .where(and(eq(shoppingItems.id, itemId), visibleToUser(householdId, user.id)))
      .limit(1);

    if (existing.length === 0) {
      return fail(404, { error: 'Item not found' });
    }

    const wasPurchased = existing[0].purchasedAt !== null;
    const purchaseFields =
      purchased === wasPurchased
        ? {}
        : {
            purchasedAt: purchased ? new Date() : null,
            purchasedBy: purchased ? user.id : null
          };

    // Only the person who added an item may change who can see it. Otherwise any
    // member could flip a shared item to personal, which hides it from everyone
    // except its author -- including from the member who did it, so it could not
    // be undone.
    const effectiveVisibility: 'shared' | 'personal' =
      existing[0].addedBy === user.id ? visibility : existing[0].visibility;

    // Scope the update to items this user may see, so a guessed id cannot
    // reach a housemate's personal item.
    const result = await db
      .update(shoppingItems)
      .set({
        name,
        quantity,
        notes,
        categoryId,
        visibility: effectiveVisibility,
        ...purchaseFields,
        updatedAt: new Date()
      })
      .where(and(eq(shoppingItems.id, itemId), visibleToUser(householdId, user.id)));

    if (result.rowsAffected === 0) {
      return fail(404, { error: 'Item not found' });
    }

    return { success: true };
  },

  /**
   * Mark one or more items purchased, or put them back on the list.
   *
   * Takes a list so the same action serves the bulk bar and the edit form.
   */
  setPurchased: async ({ request, locals, params }) => {
    const householdId = params.id;
    const { user } = await requireMembership(locals, householdId);

    const formData = await request.formData();
    const itemIds = formData.getAll('itemIds') as string[];
    const purchased = formData.get('purchased') === 'true';

    if (itemIds.length === 0) {
      return fail(400, { error: 'No items selected' });
    }

    // Restrict to rows whose state actually changes. A mixed selection (some
    // already bought) reads as "not all purchased" in the UI, so without this
    // the already-purchased rows would be re-stamped with the current user and
    // time, losing who really bought them and when.
    const stateChanges = purchased
      ? isNull(shoppingItems.purchasedAt)
      : isNotNull(shoppingItems.purchasedAt);

    const result = await db
      .update(shoppingItems)
      .set({
        purchasedAt: purchased ? new Date() : null,
        purchasedBy: purchased ? user.id : null,
        updatedAt: new Date()
      })
      .where(
        and(inArray(shoppingItems.id, itemIds), visibleToUser(householdId, user.id), stateChanges)
      );

    if (result.rowsAffected === 0) {
      return fail(404, { error: 'Nothing to update' });
    }

    return { success: true };
  },

  removeItems: async ({ request, locals, params }) => {
    const householdId = params.id;
    const { user } = await requireMembership(locals, householdId);

    const formData = await request.formData();
    const itemIds = formData.getAll('itemIds') as string[];

    if (itemIds.length === 0) {
      return fail(400, { error: 'No items selected' });
    }

    const result = await db
      .delete(shoppingItems)
      .where(and(inArray(shoppingItems.id, itemIds), visibleToUser(householdId, user.id)));

    if (result.rowsAffected === 0) {
      return fail(404, { error: 'Items not found' });
    }

    return { success: true };
  },

  createCategory: async ({ request, locals, params }) => {
    const householdId = params.id;
    await requireMembership(locals, householdId);

    const formData = await request.formData();
    const name = (formData.get('name') as string)?.trim();
    const color = (formData.get('color') as string)?.trim() || null;

    if (!name) {
      return fail(400, { error: 'Category name is required' });
    }

    const existing = await db
      .select({ id: shoppingCategories.id })
      .from(shoppingCategories)
      .where(
        and(
          eq(shoppingCategories.householdId, householdId),
          sql`lower(${shoppingCategories.name}) = lower(${name})`
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return fail(400, { error: 'That category already exists' });
    }

    const maxOrder = await db
      .select({ max: sql<number>`coalesce(max(${shoppingCategories.sortOrder}), -1)` })
      .from(shoppingCategories)
      .where(eq(shoppingCategories.householdId, householdId));

    await db.insert(shoppingCategories).values({
      id: generateId(),
      householdId,
      name,
      color,
      sortOrder: (maxOrder[0]?.max ?? -1) + 1,
      createdAt: new Date()
    });

    return { success: true };
  },

  updateCategory: async ({ request, locals, params }) => {
    const householdId = params.id;
    await requireMembership(locals, householdId);

    const formData = await request.formData();
    const categoryId = formData.get('categoryId') as string;
    const name = (formData.get('name') as string)?.trim();
    const color = (formData.get('color') as string)?.trim() || null;

    if (!categoryId || !name) {
      return fail(400, { error: 'Category name is required' });
    }

    // Same guard as createCategory: two categories with one name are
    // indistinguishable in the list, which groups by id.
    const clash = await db
      .select({ id: shoppingCategories.id })
      .from(shoppingCategories)
      .where(
        and(
          eq(shoppingCategories.householdId, householdId),
          ne(shoppingCategories.id, categoryId),
          sql`lower(${shoppingCategories.name}) = lower(${name})`
        )
      )
      .limit(1);

    if (clash.length > 0) {
      return fail(400, { error: 'That category already exists' });
    }

    const result = await db
      .update(shoppingCategories)
      .set({ name, color })
      .where(
        and(eq(shoppingCategories.id, categoryId), eq(shoppingCategories.householdId, householdId))
      );

    if (result.rowsAffected === 0) {
      return fail(404, { error: 'Category not found' });
    }

    return { success: true };
  },

  deleteCategory: async ({ request, locals, params }) => {
    const householdId = params.id;
    // Admin-only: deleting a category also clears it from every item in the
    // household, including members' personal items, and the old association
    // cannot be recovered. Adding and renaming stay open to any member.
    await requireAdmin(locals, householdId, 'delete shopping categories');

    const formData = await request.formData();
    const categoryId = formData.get('categoryId') as string;

    if (!categoryId) {
      return fail(400, { error: 'Category is required' });
    }

    // Items fall back to uncategorised rather than being deleted; the schema's
    // ON DELETE SET NULL covers this, but it is done explicitly so the behaviour
    // does not depend on SQLite's FK enforcement being on.
    //
    // Both writes share a transaction: clearing the items and then failing to
    // delete the category would strip the categorisation with nothing to show
    // for it, and the old association cannot be recovered.
    const deleted = await db.transaction(async (tx) => {
      await tx
        .update(shoppingItems)
        .set({ categoryId: null, updatedAt: new Date() })
        .where(
          and(eq(shoppingItems.householdId, householdId), eq(shoppingItems.categoryId, categoryId))
        );

      const result = await tx
        .delete(shoppingCategories)
        .where(
          and(
            eq(shoppingCategories.id, categoryId),
            eq(shoppingCategories.householdId, householdId)
          )
        );

      return result.rowsAffected;
    });

    if (deleted === 0) {
      return fail(404, { error: 'Category not found' });
    }

    return { success: true };
  }
};
