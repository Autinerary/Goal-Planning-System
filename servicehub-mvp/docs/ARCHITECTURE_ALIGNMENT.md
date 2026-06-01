# Architecture Alignment Plan

This document outlines the alignment of ServiceHub with the specified architecture.

## Page 0: Recommendations Page (Home)

### Current Status:
- ✅ Highest Ratings: "Popular Resources" section exists
- ❌ Avoidances: Missing - needs low-rated resources with reasons
- ❌ Cheapest: Missing - requires `price` field in schema
- ⚠️ In your location: Partially exists, not organized by category
- ✅ Quality Lists: "Most Useful Resources" exists
- ✅ Clusters/Profiles: Pattern Agent discoveries exist

### Implementation Plan:
1. ✅ Add `getAvoidancesResources()` function (DONE)
2. ✅ Add `getHighestRatedByCategory()` function (DONE)
3. ✅ Add `getLocationResources()` function (DONE)
4. ⏳ Create Avoidances section component
5. ⏳ Create Location-based collections by category
6. ⏳ Reorganize home page to match architecture order
7. ⏳ Add price field to schema (if needed for Cheapest section)

## Page 1: Search via Filters

### Current Status:
- ✅ Search bar exists
- ✅ Filter categories: Resource Type, Location, Systematic Barrier, Ratings
- ⚠️ Missing: Where in Journey, Topic, Price filters
- ✅ Multiple filter selection works

### Implementation Plan:
1. Add "Where in Journey" filter option
2. Add "Topic" filter option
3. Add "Price" filter (if price field added)

## Page 2: Resulting Resources

### Current Status:
- ✅ Results page exists at `/search`
- ✅ Shows matching resources
- ⚠️ Not split by resource type (Service, Good, Video) - currently just list/grid view

### Implementation Plan:
1. Add resource type grouping
2. Split results by type: Service, Good, Video

## Page 3: Individual Resource

### Current Status:
- ✅ Resource detail page exists
- ✅ Shows all critical details
- ✅ Ratings with barrier-specific scores
- ✅ Comments/reviews
- ✅ Save buttons (Wishlist, Current, Past)
- ✅ Location and distance
- ✅ Contact details

### Notes:
- All required features appear to be implemented

## Page 4: Your Resources

### Current Status:
- ✅ Page exists at `/my-resources`
- ✅ Tabs: Saved (Wishlist), Current, Past
- ✅ Rated resources tab
- ✅ Submitted resources tab

### Notes:
- Matches architecture requirements ✅

## Page 5: Make a Recommendation

### Current Status:
- ✅ Resource submission page exists at `/resources/new`
- ✅ All fields present
- ✅ Validation and moderation queue

### Critical Issue:
- ❌ Architecture states: "The actual rating of resources is limited to 'Raters' that the company has personally selected"
- ⚠️ Currently: All authenticated users can rate
- Action Required: Add "rater" role/permission system

### Implementation Plan:
1. Add `is_rater` boolean or `rater_status` to `profiles` table
2. Update rating submission to check rater status
3. Allow all users to recommend resources
4. Only allow "Raters" to rate resources
