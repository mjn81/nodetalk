#!/bin/sh

# Replace VITE_API_URL placeholder in JS files with the actual environment variable
# We search for the string "___VITE_API_URL_PLACEHOLDER___" which we will bake in during build time
if [ -n "$VITE_API_URL" ]; then
  echo "Setting API URL to $VITE_API_URL"
  find /usr/share/nginx/html -name "*.js" -exec sed -i "s|___VITE_API_URL_PLACEHOLDER___|$VITE_API_URL|g" {} +
fi

# Execute the default Nginx command
exec "$@"
