# ServiceHub Testing Checklist

This document provides a comprehensive testing checklist for ServiceHub before launch.

## 1. Functionality Testing

### Authentication & User Management
- [ ] User registration works with email/password
- [ ] Email confirmation flow works (if enabled)
- [ ] User login works with correct credentials
- [ ] Login fails with incorrect credentials (proper error message)
- [ ] Password reset flow works (forgot password → email → reset)
- [ ] User can sign out successfully
- [ ] Session persists across page refreshes
- [ ] Session expires after inactivity (if configured)

### Onboarding Flow
- [ ] Onboarding flow displays for new users
- [ ] User can complete all onboarding steps
- [ ] Role selection works (Self-advocate, Parent, Caregiver, Professional)
- [ ] Location selection works (City, Province/State)
- [ ] Barrier selection works for all categories:
  - [ ] Neurodivergence barriers
  - [ ] Non-neurodivergent disabilities
  - [ ] Identity & Background
  - [ ] Health considerations
- [ ] Multiple barriers can be selected (intersectionality)
- [ ] Severity/impact rating works for each barrier
- [ ] Additional context fields work
- [ ] Form validation works (required fields)
- [ ] Onboarding data saves to database correctly
- [ ] User embedding generates after onboarding completion
- [ ] User is redirected to home page after completion

### Search & Filtering
- [ ] Search bar accepts text input
- [ ] Search results appear with debounced input
- [ ] Search suggestions appear (if implemented)
- [ ] Category filters work (multi-select)
- [ ] Barrier type filters work
- [ ] Location/distance filter works (if user location provided)
- [ ] Rating filter works (minimum star rating)
- [ ] Sort options work:
  - [ ] Relevance
  - [ ] Highest rated
  - [ ] Closest to me
  - [ ] Most reviewed
  - [ ] Newest
- [ ] View toggle works (grid/list view)
- [ ] Pagination works (20 results per page)
- [ ] URL parameters reflect search state (shareable links)
- [ ] Empty search results show appropriate message
- [ ] Search works on mobile (filters in drawer/modal)
- [ ] Semantic search returns relevant results (vector similarity)

### Resource Detail Page
- [ ] Resource detail page loads correctly
- [ ] All resource information displays:
  - [ ] Name, category, description
  - [ ] Location (address, city, province)
  - [ ] Contact information (phone, email, website)
  - [ ] Image (if available)
- [ ] Map displays resource location correctly (Leaflet/OpenStreetMap)
- [ ] Save/unsave button works (if logged in)
- [ ] Share button copies link to clipboard
- [ ] Ratings breakdown displays:
  - [ ] Overall average rating
  - [ ] Average scores by barrier type
  - [ ] Rating distribution chart (histogram)
- [ ] Community reviews section displays:
  - [ ] All reviews with user roles
  - [ ] Barrier-specific scores (if provided)
  - [ ] Review comments
  - [ ] "Helpful" button works
  - [ ] Sort options work (Most helpful, Newest, Highest rated)
  - [ ] Pagination works for reviews
- [ ] Similar resources section displays (4-6 resources)
- [ ] "Add Your Rating" button appears (if logged in and not rated)
- [ ] Breadcrumbs work correctly
- [ ] 404 page displays for non-existent resources
- [ ] Loading states display correctly
- [ ] OpenGraph meta tags work (social sharing)

### Rating & Review System
- [ ] Rating form displays correctly
- [ ] Overall rating (1-5 stars) is required
- [ ] Barrier-specific ratings work (only user's barriers shown)
- [ ] Text review accepts up to 500 characters (with counter)
- [ ] Photo upload works (max 2 images, compression works)
- [ ] Form validation works (overall rating required)
- [ ] Duplicate rating prevention works (edit existing rating instead)
- [ ] Rating submission works (saves to database)
- [ ] Rating appears in moderation queue
- [ ] Success message displays after submission
- [ ] User is redirected to resource detail page after submission
- [ ] Edit rating form pre-fills existing data
- [ ] Image preview works before upload
- [ ] Image compression works (max 500KB per image)

### Resource Submission
- [ ] Resource submission form displays correctly
- [ ] All form fields work:
  - [ ] Name (required)
  - [ ] Category dropdown
  - [ ] Description (textarea, 1000 char limit)
  - [ ] Location search (address autocomplete)
  - [ ] Contact details (phone, email, website)
  - [ ] Photo upload (optional)
  - [ ] Recommendation reason (optional)
- [ ] Address autocomplete works (OpenStreetMap Nominatim)
- [ ] Form validation works (clear error messages)
- [ ] Duplicate resource detection works (name + location)
- [ ] Draft auto-saves to localStorage (every 30 seconds)
- [ ] Draft restores when user returns
- [ ] Preview modal shows submission data correctly
- [ ] Submission saves to database (status='pending')
- [ ] Submission appears in moderation queue
- [ ] Success message explains approval process
- [ ] Image upload works (Supabase Storage)

### Saved Resources (My Resources)
- [ ] "Saved" tab displays saved resources correctly
- [ ] "Rated" tab displays rated resources correctly
- [ ] "Submitted" tab displays submitted resources correctly
- [ ] Empty states display with call-to-action
- [ ] Resource cards display correctly in all tabs
- [ ] Notes feature works (add, edit, delete notes on saved resources)
- [ ] Quick actions work (View, Remove from saved, Edit rating)
- [ ] Sorting works (by date, rating, distance)
- [ ] Filtering works (by category)
- [ ] Export functionality works (JSON/CSV, if implemented)
- [ ] Shareable link works (if implemented)

### Recommendations
- [ ] Recommendations appear on home page (if logged in)
- [ ] Recommendations are relevant to user's barriers
- [ ] Recommendations show explanations
- [ ] Confidence scores display (if shown)
- [ ] Recommendations update when user barriers change
- [ ] Agent explanation displays correctly
- [ ] Synthesis explanation displays (if implemented)
- [ ] Agent contribution breakdown displays (if implemented)

### Admin Dashboard
- [ ] Admin dashboard is only accessible to admin users
- [ ] Non-admin users cannot access admin routes
- [ ] Dashboard overview displays:
  - [ ] Total resources, ratings, users (with growth indicators)
  - [ ] Pending moderation count (clickable)
  - [ ] Recent activity feed
  - [ ] Top resources this week
  - [ ] User growth chart
- [ ] Moderation queue works:
  - [ ] Items flagged by Validation Agent display
  - [ ] Agent reasoning and confidence display
  - [ ] Admin can approve/reject items
  - [ ] Admin overrides are tracked
- [ ] Resource management works:
  - [ ] List all resources with filters
  - [ ] Edit resource details
  - [ ] Delete resource (soft delete)
  - [ ] Bulk actions work (approve multiple, delete multiple)
- [ ] User management works:
  - [ ] List all users
  - [ ] View user profiles and activity
  - [ ] Assign roles (user, admin, moderator)
  - [ ] Ban/unban users
- [ ] Insights page displays patterns and analytics
- [ ] Data management page works (seed/clear test data)

### Notifications System
- [ ] Notification bell displays in Navbar (if logged in)
- [ ] Unread count badge displays correctly
- [ ] Dropdown shows recent notifications
- [ ] "Mark all as read" button works
- [ ] Individual notifications can be marked as read
- [ ] Notifications page displays all notifications
- [ ] Notifications filter and paginate correctly
- [ ] Real-time updates work (Supabase Realtime)
- [ ] Notifications trigger for:
  - [ ] Resource approved/rejected (notify submitter)
  - [ ] Rating marked helpful (notify rater)
  - [ ] Saved resource has new rating (notify saver)

### Agent System
- [ ] Orchestrator coordinates agents correctly
- [ ] Recommendation Agent returns relevant results
- [ ] Pattern Recognition Agent discovers patterns
- [ ] Validation Agent catches spam/inappropriate content
- [ ] Synthesis Engine explains decisions
- [ ] Agent confidence scores are accurate
- [ ] Agent activity log displays in admin dashboard
- [ ] Agent execution times are reasonable (< 5 seconds)

## 2. Cross-Browser Testing

### Desktop Browsers
- [ ] Chrome (latest version)
  - [ ] All features work correctly
  - [ ] UI renders correctly
  - [ ] No console errors
- [ ] Safari (latest version)
  - [ ] All features work correctly
  - [ ] UI renders correctly
  - [ ] No console errors
- [ ] Firefox (latest version)
  - [ ] All features work correctly
  - [ ] UI renders correctly
  - [ ] No console errors
- [ ] Edge (latest version)
  - [ ] All features work correctly
  - [ ] UI renders correctly
  - [ ] No console errors

### Mobile Browsers
- [ ] iOS Safari (iPhone)
  - [ ] Touch targets are at least 44x44px
  - [ ] Forms work correctly (keyboard types)
  - [ ] Navigation works (hamburger menu)
  - [ ] Images optimize correctly
  - [ ] No horizontal scrolling
- [ ] Android Chrome
  - [ ] Touch targets are at least 44x44px
  - [ ] Forms work correctly (keyboard types)
  - [ ] Navigation works (hamburger menu)
  - [ ] Images optimize correctly
  - [ ] No horizontal scrolling

## 3. Performance Testing

- [ ] Page load times < 3 seconds (first contentful paint)
- [ ] Time to interactive < 5 seconds
- [ ] Agent responses < 5 seconds
- [ ] Images are optimized (Next.js Image component)
- [ ] No console errors
- [ ] No memory leaks (test with Chrome DevTools)
- [ ] Bundle size is reasonable (< 1MB initial load)
- [ ] Lazy loading works for images and components
- [ ] Caching works correctly (browser cache, CDN if used)
- [ ] Lighthouse scores:
  - [ ] Performance: 90+
  - [ ] Accessibility: 90+
  - [ ] Best Practices: 90+
  - [ ] SEO: 90+

## 4. Accessibility Testing

- [ ] Screen reader compatible
  - [ ] Test with NVDA (Windows)
  - [ ] Test with VoiceOver (macOS/iOS)
  - [ ] All interactive elements are announced
  - [ ] Forms are properly labeled
  - [ ] Error messages are announced
- [ ] Keyboard navigation works
  - [ ] Tab order is logical
  - [ ] All interactive elements are focusable
  - [ ] Focus indicators are visible
  - [ ] Skip links work
- [ ] Color contrast meets WCAG AA standards
  - [ ] Text contrast ratio ≥ 4.5:1 (normal text)
  - [ ] Text contrast ratio ≥ 3:1 (large text)
  - [ ] Use WebAIM Contrast Checker
- [ ] Focus indicators are visible
  - [ ] All focusable elements have visible focus rings
  - [ ] Focus rings are at least 2px wide
- [ ] ARIA labels are present
  - [ ] Buttons have accessible names
  - [ ] Forms have labels (or aria-label)
  - [ ] Images have alt text
  - [ ] Landmarks are properly marked
- [ ] Error messages are announced
  - [ ] Form validation errors are announced
  - [ ] Error messages are associated with form fields
- [ ] Accessibility settings work
  - [ ] Font size controls work
  - [ ] High contrast mode works
  - [ ] Reduced motion respects prefers-reduced-motion
  - [ ] Screen reader optimization mode works

## 5. Security Testing

- [ ] RLS (Row Level Security) policies work
  - [ ] Users can only see their own data
  - [ ] Users cannot access other users' data
  - [ ] Public data is accessible to all
- [ ] Auth routes are protected
  - [ ] Protected routes redirect to login
  - [ ] Auth pages redirect if already logged in
- [ ] Admin routes are restricted
  - [ ] Only admin users can access admin routes
  - [ ] Non-admin users get 403/redirect
- [ ] SQL injection prevention
  - [ ] Use parameterized queries (Supabase handles this)
  - [ ] User input is sanitized
- [ ] XSS prevention
  - [ ] User-generated content is sanitized
  - [ ] React escapes by default, but verify
- [ ] CSRF protection (if applicable)
- [ ] Environment variables are not exposed
  - [ ] No sensitive keys in client-side code
  - [ ] Service role key only in server-side code
- [ ] File upload security
  - [ ] File types are validated
  - [ ] File sizes are limited
  - [ ] Images are validated (not executable files)

## 6. Edge Cases & Error Handling

- [ ] No internet connection (offline mode)
  - [ ] Appropriate error message
  - [ ] Retry functionality
- [ ] Supabase rate limits exceeded
  - [ ] Error message displays
  - [ ] User can retry
- [ ] Invalid resource ID in URL
  - [ ] 404 page displays
  - [ ] User-friendly error message
- [ ] Unauthorized access attempts
  - [ ] Proper redirect/error message
- [ ] Form validation errors
  - [ ] Clear error messages
  - [ ] Errors are announced to screen readers
- [ ] Image upload failures
  - [ ] Error message displays
  - [ ] User can retry
- [ ] Duplicate submissions
  - [ ] Prevented or handled gracefully
- [ ] Empty states
  - [ ] Display appropriate messages
  - [ ] Include calls-to-action
- [ ] Error boundaries work
  - [ ] Errors are caught and displayed
  - [ ] User can retry or navigate away

## 7. Database Testing

- [ ] Database schema is correct (run schema.sql)
- [ ] All tables exist
- [ ] Indexes are created
- [ ] RLS policies are enabled
- [ ] Vector extension (pgvector) is enabled
- [ ] Vector functions work correctly
- [ ] Seeding script works (creates test data)
- [ ] Clear script works (removes test data)
- [ ] Foreign key constraints work
- [ ] Data integrity is maintained

## 8. Integration Testing

- [ ] Supabase integration works
  - [ ] Authentication works
  - [ ] Database queries work
  - [ ] Storage uploads work
  - [ ] Realtime subscriptions work
- [ ] Embedding generation works
  - [ ] User embeddings generate
  - [ ] Resource embeddings generate
  - [ ] Vector similarity search works
- [ ] Agent orchestration works
  - [ ] Agents are called correctly
  - [ ] Agent outputs are combined correctly
  - [ ] Synthesis engine works

## Notes

- Test with both logged-in and logged-out users
- Test with different user roles (admin, regular user)
- Test with users who have completed onboarding and those who haven't
- Test with empty database and populated database
- Test with slow network (throttle in DevTools)
- Document any bugs found with steps to reproduce
