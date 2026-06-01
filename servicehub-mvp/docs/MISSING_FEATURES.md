# Missing Features from Wireframes

This document tracks features shown in the wireframes that need to be implemented.

## 1. Home Page - Multiple Quality Lists

**Current State:**
- Has "Recommended for You" (AI-powered)
- Has "Popular Resources" (highest rated)
- Has "Recently Added"

**Missing:**
- **Quality X List (ex. Highest Ratings)** - Already exists as "Popular Resources" ✓
- **Quality Y List (ex. Useful/Table of Use)** - Need "Most Useful" based on helpful_count
- Note: Wireframe says "AI is HERE ONLY for clusters/profiles (combos & qualities)" - Current AI is only in recommendations section ✓

**Action Items:**
- [ ] Add "Most Useful Resources" section (sorted by helpful_count or usefulness metric)
- [ ] Keep AI recommendations separate from quality lists

---

## 2. Search Page - Systematic Barrier Filter

**Current State:**
- Has Category filter (checkboxes)
- Has Rating filter
- Has Distance filter

**Missing:**
- **Systematic Barrier Filter** (accordion/dropdown style)
  - Should show barriers like: autism, ADHD, sensory, mobility, etc.
  - Should be in accordion format (expandable/collapsible)
  - Should allow multi-select

**Action Items:**
- [ ] Add Systematic Barrier filter to FilterSidebar
- [ ] Convert filters to accordion style (collapsible sections)
- [ ] Add barrier type options from user_barriers table

---

## 3. Resource Detail Page - Missing Features

**Current State:**
- Has rating breakdown (but not collapsible)
- Has barrier scores
- Has description
- Has contact info

**Missing:**

1. **"Recommended by Autism Community" badge**
   - Should show if resource has high ratings from autism community
   - Green badge with checkmark

2. **Collapsible Rating Breakdown**
   - Current breakdown is always visible
   - Should have "Rating Breakdown ▲/▼" button to toggle

3. **Specific Quality Ratings Display**
   - Need to show individual quality scores:
     - Quality 1 (Accessibility): 5.0
     - Quality 2 (Staff Knowledge): 4.2
     - Quality 3 (Sensory-Friendly): 4.6
     - Quality 4 (Communication): 4.8
     - Quality 5 (Wait Times): 4.3
     - Quality 6 (Affordability): 4.5
   - These should map to barrier_scores in ratings table

4. **Provider Hours**
   - Need to add `provider_hours` field to resources
   - Display format: "Monday - Friday: 9:00 AM - 5:00 PM"

5. **Type of Services**
   - Need to add `service_type` or use `category` field
   - Display: "Therapy", "Education", etc.

6. **"Get Directions" Button**
   - Should open map with directions
   - Use location data to link to Google Maps or similar

**Action Items:**
- [ ] Add "Recommended by Autism Community" badge component
- [ ] Make Rating Breakdown collapsible
- [ ] Display quality ratings (Accessibility, Staff Knowledge, etc.) from barrier_scores
- [ ] Add provider_hours field to schema (or use contact_info JSONB)
- [ ] Add service_type display (use category or add new field)
- [ ] Add "Get Directions" button with map link

---

## 4. My Resources Page - Missing Sections

**Current State:**
- Has "Saved" tab (Wishlist)
- Has "Rated" tab
- Has "Submitted" tab

**Missing:**
- **"Current Resources" section**
  - Resources user is currently using
  - Should have "Add" button

- **"Past Resources" section**
  - Resources user has used in the past
  - Should have "Add" button

**Note:** These require a new data model:
- Need `user_resource_status` table or add status field to `saved_resources`
- Statuses: 'wishlist', 'current', 'past'

**Action Items:**
- [ ] Add status field to saved_resources or create new table
- [ ] Add "Current Resources" tab/section
- [ ] Add "Past Resources" tab/section
- [ ] Add "Add" buttons to each section
- [ ] Update SavedTab to allow status changes

---

## Implementation Priority

1. **High Priority:**
   - Collapsible Rating Breakdown
   - "Recommended by Autism Community" badge
   - Quality ratings display (Accessibility, Staff Knowledge, etc.)
   - "Get Directions" button
   - Provider Hours (use contact_info JSONB)

2. **Medium Priority:**
   - Systematic Barrier filter in search
   - Accordion-style filters
   - "Most Useful Resources" section on home page

3. **Low Priority:**
   - Current/Past Resources sections (requires schema change)
   - Service Type field (can use category for now)

---

## Schema Changes Needed

1. **saved_resources table:**
   - Add `status` field: 'wishlist' | 'current' | 'past' (default: 'wishlist')
   - OR create separate `user_resource_status` table

2. **resources table:**
   - Consider adding `provider_hours` field (or store in contact_info JSONB)
   - Service type can use existing `category` field

---

## Notes

- Wireframes show specific quality metrics that should map to barrier_scores
- AI should only be used for recommendations/clusters, not for quality lists
- Quality lists should be based on metrics (ratings, helpful_count, etc.)
