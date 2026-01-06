# RoomieSync Web - Project Overview

## Project Vision
Simplified web port of the original RoomieSync mobile app, focused on shared household expense tracking and payment coordination. Lightweight, responsive, and works on all devices.

## Architecture

### Tech Stack
- **Framework**: SvelteKit with TypeScript
- **Database**: Turso/LibSQL with Drizzle ORM
- **Hosting**: Vercel (free tier)
- **Auth**: Custom session management (no library dependencies)
  - Cryptographically secure session tokens
  - SHA-256 secret hashing
  - HttpOnly, Secure, SameSite cookies
  - 7-day session expiration
  - Constant-time comparison to prevent timing attacks
- **Styling**: CSS custom properties for theming system

### Type Safety
- Use `.ts` files everywhere
- Svelte components with `lang="ts"`
- Drizzle ORM provides full type inference for database queries
- No manual type casting needed for database results

### Theming System
- CSS custom properties for color palettes and theme modes
- Household-specific color schemes that override app theme when viewing that household
- Architecture supports future custom comprehensive theming (color picker)
- Reference implementation: [matt-jones-website](https://github.com/Centerville1/matt-jones-website)

## Core Data Models

### Users
- Single user account can join multiple households
- Email + password authentication
- User profile (name, avatar optional)

### Households
- Creator becomes admin with elevated permissions (delete/edit house, manage members)
- Future: ability to promote members to admin
- Customization: name, colors, image, banner
- Color scheme overrides app theme when viewing household

### Invites
- One-time use per email address
- Shows in invitee's homepage when they log in
- Generates shareable link
- No email notifications in MVP

### Expenses
- **Creator**: User who paid for the expense (already paid)
- **Amount**: Total cost
- **Description**: What the expense is for
- **Date**: When expense was created
- **Split With**: Subset or all household members (default: everyone)
- **Optional Flag**: Expense people can pay if they want, doesn't add to total IOUs
- **Receipt Image**: Optional attachment
- **Payment Tracking**: Track if/when each person marked expense as paid
- All-or-nothing payment per person (no partial payments in MVP)

## User Flows

### Account & Household Management
1. Sign up / login with email + password
2. Create household or accept invite from homepage
3. Join household via one-time invite link
4. Customize household (admin only): colors, image, banner

### Expense Creation & Payment
1. Inside household, click "Split the Cost"
2. Enter amount, description, select who to split with (default: everyone)
3. Optionally: add receipt image, mark as optional expense
4. Expense appears under creator's column (they've already paid)
5. Other members see expense in their column as unpaid
6. Members select unpaid expenses, calculator sums total, shows "Send $X to [Creator]"
7. After sending money externally (Venmo, etc.), mark expenses as paid
8. Paid expenses hidden by default (show via filter adjustment)

### Expense Management
- Edit/delete expenses after creation
- Prompt user to coordinate if editing/deleting already-paid expenses
- Undo payment marks

## MVP UI/UX

### Pages
- **Auth Flow**: Sign up / login
- **Homepage**:
  - Show pending household invites at top
  - List of user's households
  - Unpaid shared expenses summary
- **Household View**:
  - Header with household info (image, banner, name)
  - Unpaid expenses highlighted at top
  - Column layout with all household members
  - Each column shows that member's expenses (what they paid for)
  - Checkmarks in columns indicate who has paid each expense
  - Horizontal scroll on mobile
- **Split Cost Flow**: Multi-step form to create expense
- **Pay Expenses**: Select expenses by user, calculator, mark as paid
- **Settings**: Household management (admin), member management

### Visual Design
- Responsive design, mobile-first
- Optional expenses visually differentiated in columns
- Paid expenses hidden unless filter adjusted
- Household color scheme applies throughout household views

## MVP Exclusions
- No shopping list feature (original app had this)
- No email notifications for invites
- No password reset / email verification (future enhancement)
- No partial payments
- No comprehensive custom theming UI (architecture in place for future)

## Future Enhancements
- Email notifications
- Password reset / email verification
- Partial payments
- Comprehensive household theming with color picker
- Ability to promote members to admin
- Expense categories
- Receipt OCR
- Payment history/analytics
- Export data
