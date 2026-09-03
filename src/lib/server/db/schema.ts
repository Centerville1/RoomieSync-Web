import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Users table
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  hashedPassword: text('hashed_password').notNull(),
  name: text('name').notNull(),
  avatar: text('avatar'),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

// Sessions table
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  secretHash: text('secret_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

// Households table
export const households = sqliteTable('households', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  creatorId: text('creator_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url'),
  bannerUrl: text('banner_url'),
  primaryColor: text('primary_color'),
  secondaryColor: text('secondary_color'),
  // Free-form notes an admin sets for the household: wifi, bin days, house
  // rules. Plain text, rendered with line breaks preserved and never as markup.
  // NULL or empty means the card is hidden entirely.
  info: text('info'),
  infoUpdatedAt: integer('info_updated_at', { mode: 'timestamp' }),
  // Archived households drop out of the main list on the homepage but stay
  // fully usable. NULL means active, so state and timestamp cannot disagree.
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
  archivedBy: text('archived_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

// Household members junction table
export const householdMembers = sqliteTable('household_members', {
  id: text('id').primaryKey(),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['admin', 'member'] })
    .notNull()
    .default('member'),
  displayName: text('display_name'), // Optional per-household display name (falls back to user.name)
  joinedAt: integer('joined_at', { mode: 'timestamp' }).notNull()
});

// Invites table
export const invites = sqliteTable('invites', {
  id: text('id').primaryKey(),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  invitedEmail: text('invited_email').notNull(),
  token: text('token').notNull().unique(),
  createdBy: text('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  used: integer('used', { mode: 'boolean' }).notNull().default(false),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' })
});

// Expenses table
export const expenses = sqliteTable('expenses', {
  id: text('id').primaryKey(),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  creatorId: text('creator_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  description: text('description').notNull(),
  isOptional: integer('is_optional', { mode: 'boolean' }).notNull().default(false),
  // Rent is a label on an ordinary expense, not a separate recurring concept:
  // it colours the row and drives the Pay Rent banner while the user's own
  // split is unpaid.
  isRent: integer('is_rent', { mode: 'boolean' }).notNull().default(false),
  receiptUrl: text('receipt_url'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

// Expense splits table
export const expenseSplits = sqliteTable('expense_splits', {
  id: text('id').primaryKey(),
  expenseId: text('expense_id')
    .notNull()
    .references(() => expenses.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // What this person owes. Stored per split rather than derived, so an expense
  // can be divided unevenly. Every read uses this value: deriving it as
  // amount/count anywhere would silently ignore overrides.
  //
  // The splits always sum to the expense amount. Remainder pennies from an
  // uneven division go to the expense creator, who is already paying up front.
  amount: real('amount').notNull().default(0),
  hasPaid: integer('has_paid', { mode: 'boolean' }).notNull().default(false),
  paidAt: integer('paid_at', { mode: 'timestamp' })
});

// Type exports for use throughout the app
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;

export type HouseholdMember = typeof householdMembers.$inferSelect;
export type NewHouseholdMember = typeof householdMembers.$inferInsert;

export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;

export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;

export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type NewExpenseSplit = typeof expenseSplits.$inferInsert;

// Password reset tokens table
export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// Email verification tokens table
export const emailVerificationTokens = sqliteTable('email_verification_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type NewEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;

// Nudge history table - tracks payment reminders between users
export const nudgeHistory = sqliteTable('nudge_history', {
  id: text('id').primaryKey(),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  fromUserId: text('from_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  toUserId: text('to_user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  customMessage: text('custom_message'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export type NudgeHistory = typeof nudgeHistory.$inferSelect;
export type NewNudgeHistory = typeof nudgeHistory.$inferInsert;

// Shopping list categories - custom per household
export const shoppingCategories = sqliteTable('shopping_categories', {
  id: text('id').primaryKey(),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export type ShoppingCategory = typeof shoppingCategories.$inferSelect;
export type NewShoppingCategory = typeof shoppingCategories.$inferInsert;

// Shopping list items
// Note: purchasedAt is the source of truth for "purchased" (NULL = still to buy)
// rather than a separate boolean, so state and timestamp can't drift apart.
export const shoppingItems = sqliteTable('shopping_items', {
  id: text('id').primaryKey(),
  householdId: text('household_id')
    .notNull()
    .references(() => households.id, { onDelete: 'cascade' }),
  // set null, not cascade: deleting a category must never delete its items
  categoryId: text('category_id').references(() => shoppingCategories.id, {
    onDelete: 'set null'
  }),
  visibility: text('visibility', { enum: ['shared', 'personal'] })
    .notNull()
    .default('shared'),
  name: text('name').notNull(),
  // Stored as text for backwards compatibility, but the UI edits it as a whole
  // number via a stepper. Units belong in `notes` ("2% not whole", "the big box").
  quantity: text('quantity'),
  notes: text('notes'), // specification, editable by anyone who can see the item
  addedBy: text('added_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  purchasedBy: text('purchased_by').references(() => users.id, { onDelete: 'set null' }),
  purchasedAt: integer('purchased_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export type ShoppingItem = typeof shoppingItems.$inferSelect;
export type NewShoppingItem = typeof shoppingItems.$inferInsert;
