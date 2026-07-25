# Add MinGit to PATH for the duration of this script
$env:PATH += ";c:\Users\ADMIN\aspirohithpc\mingit\cmd"

$git = "c:\Users\ADMIN\aspirohithpc\mingit\cmd\git.exe"
$gh = "C:\Program Files\GitHub CLI\gh.exe"

# If .git directory doesn't exist, initialize
if (-not (Test-Path "c:\Users\ADMIN\aspirohithpc\avatar2_digi\.git")) {
    Write-Host "Initializing local Git repository for Avatar 2..."
    & $git init
}

# Configure local git user info
Write-Host "Configuring Git user info..."
& $git config user.name "Aspirealty Staff"
& $git config user.email "info@aspirealty.com"

# Ensure branch is main
& $git branch -M main

Write-Host "Staging files..."
& $git add -A

Write-Host "Committing files..."
& $git commit -m "Initial commit of Avatar 2 Digital Layout"

Write-Host "Creating GitHub repository avatar2-digi and pushing files..."
# Create repository and push using GitHub CLI
& $gh repo create avatar2-digi --public --source=. --push

Write-Host "Enabling GitHub Pages..."
# Enable GitHub Pages on main branch root folder
& $gh api "repos/{owner}/{repo}/pages" --field "build_type=legacy" --field "source[branch]=main" --field "source[path]=/"

Write-Host "Deploy completed successfully!"
