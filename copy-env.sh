#!/bin/bash
# Script to copy Supabase credentials from ServiceHub to Goal Planning frontend

SERVICEHUB_ENV="servicehub-mvp/.env.local"
FRONTEND_ENV="frontend/.env.local"

if [ ! -f "$SERVICEHUB_ENV" ]; then
    echo "Error: $SERVICEHUB_ENV not found!"
    echo "Please create it first with your Supabase credentials."
    exit 1
fi

# Extract Supabase values from ServiceHub .env.local
SUPABASE_URL=$(grep "^NEXT_PUBLIC_SUPABASE_URL=" "$SERVICEHUB_ENV" | cut -d '=' -f2-)
SUPABASE_KEY=$(grep "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" "$SERVICEHUB_ENV" | cut -d '=' -f2-)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo "Error: Could not find Supabase credentials in $SERVICEHUB_ENV"
    exit 1
fi

# Create frontend .env.local
cat > "$FRONTEND_ENV" << EOL
# Supabase Configuration (copied from ServiceHub for unified auth)
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_KEY

# Goal Planning Backend API
API_URL=http://localhost:8000

# ServiceHub URL
NEXT_PUBLIC_SERVICE_HUB_URL=http://localhost:3001
EOL

echo "✅ Created $FRONTEND_ENV with Supabase credentials from ServiceHub"
echo ""
echo "Please restart your frontend dev server for changes to take effect."
