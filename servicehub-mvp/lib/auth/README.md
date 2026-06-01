# Authentication System

Complete authentication implementation using Supabase Auth (free tier).

## Features

- ✅ Email/password authentication
- ✅ User registration with email confirmation
- ✅ Password reset flow
- ✅ Protected routes with middleware
- ✅ Session management
- ✅ Accessible UI components
- ✅ Mobile-responsive design

## Files Structure

```
lib/auth/
  ├── AuthContext.tsx      # Auth context provider and hooks
  └── README.md           # This file

app/(auth)/
  ├── login/
  │   └── page.tsx        # Login page
  ├── signup/
  │   └── page.tsx        # Registration page
  ├── forgot-password/
  │   └── page.tsx        # Password reset request
  └── reset-password/
      └── page.tsx        # Password reset form

app/auth/
  └── callback/
      └── route.ts        # Auth callback handler

components/auth/
  └── AuthButton.tsx      # Reusable auth button component

middleware.ts             # Route protection middleware
```

## Usage

### Using Auth Context

```tsx
import { useAuth } from '@/lib/auth/AuthContext'

function MyComponent() {
  const { user, loading, signIn, signOut } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!user) return <div>Please sign in</div>

  return (
    <div>
      <p>Welcome, {user.email}!</p>
      <button onClick={signOut}>Sign out</button>
    </div>
  )
}
```

### Using AuthButton Component

```tsx
import AuthButton from '@/components/auth/AuthButton'

function Header() {
  return (
    <header>
      <h1>My App</h1>
      <AuthButton />
    </header>
  )
}
```

### Protected Routes

Protected routes are automatically handled by `middleware.ts`. Routes defined in `protectedRoutes` require authentication.

**Public routes** (accessible without auth):
- `/` - Home
- `/login` - Login page
- `/signup` - Sign up page
- `/forgot-password` - Password reset
- `/search` - Search page
- `/resource/*` - Resource detail pages

**Protected routes** (require authentication):
- `/profile` - User profile
- `/resources/my` - User's resources
- `/submit` - Submit resource

### Auth Flow

1. **Registration**:
   - User signs up at `/signup`
   - Receives confirmation email
   - Clicks link to verify account
   - Profile is automatically created in database

2. **Login**:
   - User signs in at `/login`
   - Session is stored in cookies
   - Redirected to home or requested page

3. **Password Reset**:
   - User requests reset at `/forgot-password`
   - Receives email with reset link
   - Clicks link and sets new password at `/reset-password`

4. **Session Management**:
   - Sessions are automatically refreshed
   - Auth state is synced across tabs
   - Logout clears session and redirects

## API Reference

### AuthContext

```tsx
interface AuthContextType {
  user: User | null              // Current user object
  session: Session | null        // Current session
  loading: boolean              // Loading state
  signUp: (email, password, fullName?) => Promise<{ error }>
  signIn: (email, password) => Promise<{ error }>
  signOut: () => Promise<void>
  resetPassword: (email) => Promise<{ error }>
  updatePassword: (newPassword) => Promise<{ error }>
}
```

### useAuth Hook

```tsx
const {
  user,           // User object or null
  session,        // Session object or null
  loading,        // Boolean
  signUp,         // Function
  signIn,         // Function
  signOut,        // Function
  resetPassword,  // Function
  updatePassword, // Function
} = useAuth()
```

## Styling

All auth pages use Tailwind CSS with:
- ✅ Accessible form labels and ARIA attributes
- ✅ Keyboard navigation support
- ✅ Mobile-responsive design
- ✅ Loading states
- ✅ Error messaging
- ✅ Success states

## Configuration

Make sure your Supabase project has:

1. **Email Templates** configured in Supabase Dashboard:
   - Confirm signup
   - Reset password

2. **Redirect URLs** configured:
   - Site URL: `http://localhost:3000` (dev)
   - Redirect URL: `http://localhost:3000/auth/callback`

3. **Email Provider** set up (Supabase free tier includes email)

## Security

- ✅ Passwords are hashed (handled by Supabase)
- ✅ Sessions are HTTP-only cookies
- ✅ CSRF protection via Supabase
- ✅ Email confirmation required
- ✅ Password strength validation (min 8 characters)

## Testing

1. **Sign up**:
   - Go to `/signup`
   - Fill form and submit
   - Check email for confirmation link

2. **Login**:
   - Go to `/login`
   - Enter credentials
   - Should redirect to home

3. **Protected route**:
   - Try accessing `/profile` without login
   - Should redirect to `/login`

4. **Password reset**:
   - Go to `/forgot-password`
   - Enter email
   - Check email for reset link
