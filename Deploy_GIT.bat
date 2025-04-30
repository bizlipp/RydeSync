#!/bin/bash

# === CONFIG SECTION ===
GITHUB_REPO="https://github.com/bizlipp/rydesync.git"
BRANCH="main"
LOCAL_CLONE_DIR="./rydesync-repo"
NEW_FILES_DIR="./RydeSync-Next"  # Point to your local source folder

# === BEGIN MAGIC ===

echo "🚀 Cloning GitHub repo..."
rm -rf "$LOCAL_CLONE_DIR"
git clone "$GITHUB_REPO" "$LOCAL_CLONE_DIR" || { echo "❌ Clone failed"; exit 1; }

echo "🔥 Wiping existing repo contents..."
cd "$LOCAL_CLONE_DIR" || exit 1
find . -mindepth 1 ! -name ".git" -exec rm -rf {} +

echo "📦 Copying new project files into repo..."
cp -r "$NEW_FILES_DIR"/* .

echo "✅ Committing changes..."
git add .
git commit -m "🔥 Overwrite with latest RydeSync build" || echo "⚠️ No changes to commit"

echo "📡 Pushing to GitHub with --force..."
git push origin "$BRANCH" --force || { echo "❌ Push failed"; exit 1; }

echo "🎉 Deployment complete. Check GitHub for updates."
