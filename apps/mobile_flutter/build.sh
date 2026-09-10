#!/bin/bash
set -e

# Clone Flutter stable if not present
if [ ! -d "flutter" ]; then
  echo "Cloning Flutter SDK..."
  git clone https://github.com/flutter/flutter.git --depth 1 -b stable flutter
fi

export PATH="$PWD/flutter/bin:$PATH"

echo "Flutter version:"
flutter --version

echo "Building Flutter Web release..."
flutter build web --release

echo "Build complete. Output in build/web"
