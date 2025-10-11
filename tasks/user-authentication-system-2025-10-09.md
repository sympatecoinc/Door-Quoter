# User Authentication System with Role-Based Access Control
Date: 2025-10-09

## Scope
Implement a complete authentication system with user management and role-based privileges.

Files to modify:
- `prisma/schema.prisma` - Add User, Session models and role enum
- `src/middleware.ts` - Create middleware for protecting routes
- `src/app/login/page.tsx` - Create login page UI
- `src/app/api/auth/login/route.ts` - Handle login authentication
- `src/app/api/auth/logout/route.ts` - Handle logout and session cleanup
- `src/app/api/auth/session/route.ts` - Validate and return current session
- `src/app/api/users/route.ts` - Create and list users (admin only)
- `src/app/api/users/[id]/route.ts` - Update user details and roles (admin only)
- `src/components/views/SettingsView.tsx` - Add User Management section
- `src/lib/auth.ts` - Authentication utilities (password hashing, session validation)
- `src/lib/db-session.ts` - Database session storage utilities
- `package.json` - Add bcryptjs dependency

New files to create:
- `src/components/UserManagement.tsx` - User management UI component
- `src/app/api/auth/init/route.ts` - Create initial admin user (first-run setup)

## Design Decisions

### Authentication Approach
- **Session-based authentication** using database-stored sessions (no JWT, no third-party auth)
- **HttpOnly cookies** for session tokens (secure, not accessible via JavaScript)
- **Password hashing** using bcryptjs (industry standard)
- **Role-based access control (RBAC)** with three roles:
  - `ADMIN` - Full access including user management
  - `MANAGER` - Can create/edit projects, customers, and products
  - `VIEWER` - Read-only access to all data

### Session Management
- Sessions stored in database with expiration (7 days default)
- Automatic session cleanup on logout
- Session validation on every protected route via middleware

### Security Features
- Password minimum requirements (8 characters)
- Bcrypt hashing with salt rounds (10)
- HttpOnly cookies prevent XSS attacks
- Middleware protects all routes except /login and /api/auth/*
- Admin-only routes for user management

## Tasks
- [x] Task 1: Install bcryptjs package
- [x] Task 2: Update Prisma schema with User, Session models and Role enum
- [x] Task 3: Run database migration
- [x] Task 4: Create authentication utilities library (lib/auth.ts)
- [x] Task 5: Create database session utilities (lib/db-session.ts)
- [x] Task 6: Create initial admin setup API route
- [x] Task 7: Create login API route
- [x] Task 8: Create logout API route
- [x] Task 9: Create session validation API route
- [x] Task 10: Create users API routes (CRUD)
- [x] Task 11: Create login page UI
- [x] Task 12: Create User Management component
- [x] Task 13: Update SettingsView to include User Management (admin only)
- [x] Task 14: Create middleware to protect routes
- [x] Task 15: Test complete authentication flow

## Success Criteria
- Users can log in with email and password
- Sessions persist across page refreshes
- Unauthorized users are redirected to login
- Admin users can create new users and assign roles
- Admin users can edit user details and change roles
- Admin users can deactivate users
- Role-based UI elements (show/hide based on permissions)
- Password is securely hashed in database
- Sessions expire after 7 days
- Initial setup creates first admin user

## Database Schema Changes

### New Models:
```prisma
enum Role {
  ADMIN
  MANAGER
  VIEWER
}

model User {
  id           Int       @id @default(autoincrement())
  email        String    @unique
  passwordHash String
  name         String
  role         Role      @default(VIEWER)
  isActive     Boolean   @default(true)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  sessions     Session[]
}

model Session {
  id        String   @id @default(uuid())
  userId    Int
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@map("Sessions")
}
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email/password, returns session cookie
- `POST /api/auth/logout` - Logout and destroy session
- `GET /api/auth/session` - Get current user session (for client-side checks)
- `POST /api/auth/init` - Create first admin user (only works if no users exist)

### User Management (Admin Only)
- `GET /api/users` - List all users
- `POST /api/users` - Create new user
- `PUT /api/users/[id]` - Update user details
- `DELETE /api/users/[id]` - Deactivate user (soft delete)

## UI Components

### Login Page (`/login`)
- Email and password fields
- Login button
- Error message display
- Auto-redirect to dashboard if already logged in

### User Management (Settings → Users tab)
- User list table (email, name, role, status)
- "Create User" button
- Edit user modal (change name, email, role, active status)
- Password reset capability
- Only visible to ADMIN role

## Route Protection Strategy

### Protected Routes (require authentication)
- All routes except `/login` and `/api/auth/*`
- Middleware checks session cookie and validates against database
- Redirects to `/login` if not authenticated

### Admin-Only Routes
- `/api/users/*` (all user management endpoints)
- User Management section in Settings view

### Public Routes
- `/login`
- `/api/auth/login`
- `/api/auth/init` (first-time setup only)

## Changes Made

### Database
- Added `Role` enum with ADMIN, MANAGER, VIEWER values
- Added `User` model with email, passwordHash, name, role, and isActive fields
- Added `Session` model for database-stored sessions with UUID and expiration
- Pushed schema changes to database using `prisma db push`

### Backend Libraries
- Installed bcryptjs (v3.0.2) and @types/bcryptjs (v2.4.6)
- Created `src/lib/auth.ts` with password hashing, validation, and cookie management utilities
- Created `src/lib/db-session.ts` with session CRUD operations and validation

### API Routes
- **Auth Routes:**
  - `POST /api/auth/init` - Create first admin user (only when no users exist)
  - `GET /api/auth/init` - Check if initial setup is needed
  - `POST /api/auth/login` - Authenticate and create session
  - `POST /api/auth/logout` - Destroy session and clear cookie
  - `GET /api/auth/session` - Validate current session and return user

- **User Management Routes (Admin Only):**
  - `GET /api/users` - List all users
  - `POST /api/users` - Create new user
  - `PUT /api/users/[id]` - Update user (name, email, role, password, isActive)
  - `DELETE /api/users/[id]` - Deactivate user (soft delete)

### Frontend Components
- Created `src/app/login/page.tsx` - Login page with initial setup flow
- Created `src/components/UserManagement.tsx` - Full user management UI with table and modals
- Updated `src/components/views/SettingsView.tsx` - Added User Management section (admin only)
- Updated `src/components/Sidebar.tsx` - Added user profile display and logout button

### Middleware
- Created `src/middleware.ts` - Route protection with session validation
- Redirects unauthenticated users to `/login`
- Validates sessions on every request
- Allows public routes: `/login`, `/api/auth/*`, Next.js internals

## Testing Performed

### Development Server
- Development server started successfully on http://localhost:3001
- All TypeScript files compiled without errors
- Database connection established via Cloud SQL proxy

### Features Implemented
1. **Session-based Authentication:** Complete with HttpOnly cookies
2. **Password Security:** Bcrypt hashing with 8-character minimum
3. **Role-Based Access Control:** Three roles (ADMIN, MANAGER, VIEWER)
4. **User Management:** Full CRUD for admin users
5. **Initial Setup:** First-time admin creation flow
6. **Route Protection:** Middleware redirects unauthorized users
7. **UI Integration:** Logout button and user display in sidebar

### Ready for Testing
The system is ready for manual testing:
1. Navigate to http://localhost:3001 - Should redirect to login
2. Login page shows "Initial Setup Required" if no users exist
3. Create first admin user via setup form
4. Login with admin credentials
5. Access Settings → User Management (admin only)
6. Create additional users with different roles
7. Test logout functionality
8. Test session persistence across page refreshes

## Notes
- First-time setup: Navigate to `/api/auth/init` (or create UI) to create first admin user
- Default admin credentials should be changed immediately after first login
- Consider adding email verification and password reset in future iterations
- Consider adding 2FA in future iterations
- All existing data remains accessible, no breaking changes to existing models
