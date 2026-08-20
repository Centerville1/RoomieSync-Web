import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db/client';
import { shoppingCategories, shoppingItems } from '$lib/server/db/schema';
import { eq, and, or, asc, desc, sql, inArray } from 'drizzle-orm';
import { generateId } from '$lib/server/utils';
import { requireMembership } from '$lib/server/household';

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

  // The list itself. Unpurchased first, then most recently added.
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
    .orderBy(asc(shoppingItems.purchasedAt), desc(shoppingItems.createdAt));

  // Autofill: distinct past item names for this household, ranked by how often
  // they have been added and how recently. Also carries the category last used
  // for that name so picking a suggestion can prefill it.
  //
  // Grouped on lower(name) so "Milk" and "milk" are one suggestion. Sent with
  // the page rather than served per-keystroke; a household's vocabulary is
  // small enough to filter client-side.
  const suggestions = await db
    .select({
      name: sql<string>`min(${shoppingItems.name})`,
      categoryId: sql<string | null>`(
        SELECT category_id FROM shopping_items s2
        WHERE lower(s2.name) = lower(${shoppingItems.name})
          AND s2.household_id = ${householdId}
          AND s2.category_id IS NOT NULL
        ORDER BY s2.created_at DESC LIMIT 1
      )`,
      uses: sql<number>`count(*)`
    })
    .from(shoppingItems)
    .where(visibleToUser(householdId, user.id))
    .groupBy(sql`lower(${shoppingItems.name})`)
    .orderBy(desc(sql`count(*)`), desc(sql`max(${shoppingItems.createdAt})`))
    .limit(200);

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

    // Guard against a category from another household
    if (categoryId) {
      const cat = await db
        .select({ id: shoppingCategories.id })
        .from(shoppingCategories)
        .where(
          and(
            eq(shoppingCategories.id, categoryId),
            eq(shoppingCategories.householdId, householdId)
          )
        )
        .limit(1);
      if (cat.length === 0) {
        return fail(400, { error: 'Unknown category' });
      }
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

    if (!itemId || !name) {
      return fail(400, { error: 'Item name is required' });
    }

    // Scope the update to items this user may see, so a guessed id cannot
    // reach a housemate's personal item.
    const result = await db
      .update(shoppingItems)
      .set({ name, quantity, notes, categoryId, updatedAt: new Date() })
      .where(and(eq(shoppingItems.id, itemId), visibleToUser(householdId, user.id)));

    if (result.rowsAffected === 0) {
      return fail(404, { error: 'Item not found' });
    }

    return { success: true };
  },

  togglePurchased: async ({ request, locals, params }) => {
    const householdId = params.id;
    const { user } = await requireMembership(locals, householdId);

    const formData = await request.formData();
    const itemId = formData.get('itemId') as string;
    const purchased = formData.get('purchased') === 'true';

    if (!itemId) {
      return fail(400, { error: 'Item is required' });
    }

    const result = await db
      .update(shoppingItems)
      .set({
        purchasedAt: purchased ? new Date() : null,
        purchasedBy: purchased ? user.id : null,
        updatedAt: new Date()
      })
      .where(and(eq(shoppingItems.id, itemId), visibleToUser(householdId, user.id)));

    if (result.rowsAffected === 0) {
      return fail(404, { error: 'Item not found' });
    }

    return { success: true };
  },

  setVisibility: async ({ request, locals, params }) => {
    const householdId = params.id;
    const { user } = await requireMembership(locals, householdId);

    const formData = await request.formData();
    const itemId = formData.get('itemId') as string;
    const visibility = formData.get('visibility') === 'personal' ? 'personal' : 'shared';

    if (!itemId) {
      return fail(400, { error: 'Item is required' });
    }

    // Only the person who added an item can change who sees it.
    const result = await db
      .update(shoppingItems)
      .set({ visibility, updatedAt: new Date() })
      .where(
        and(
          eq(shoppingItems.id, itemId),
          eq(shoppingItems.householdId, householdId),
          eq(shoppingItems.addedBy, user.id)
        )
      );

    if (result.rowsAffected === 0) {
      return fail(403, { error: 'Only the person who added an item can change its visibility' });
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

    await db
      .delete(shoppingItems)
      .where(and(inArray(shoppingItems.id, itemIds), visibleToUser(householdId, user.id)));

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
    await requireMembership(locals, householdId);

    const formData = await request.formData();
    const categoryId = formData.get('categoryId') as string;

    if (!categoryId) {
      return fail(400, { error: 'Category is required' });
    }

    // Items fall back to uncategorised rather than being deleted; the schema's
    // ON DELETE SET NULL handles this, but SQLite needs FKs enabled to enforce
    // it, so it is done explicitly here.
    await db
      .update(shoppingItems)
      .set({ categoryId: null, updatedAt: new Date() })
      .where(
        and(eq(shoppingItems.householdId, householdId), eq(shoppingItems.categoryId, categoryId))
      );

    const result = await db
      .delete(shoppingCategories)
      .where(
        and(eq(shoppingCategories.id, categoryId), eq(shoppingCategories.householdId, householdId))
      );

    if (result.rowsAffected === 0) {
      return fail(404, { error: 'Category not found' });
    }

    return { success: true };
  }
};
