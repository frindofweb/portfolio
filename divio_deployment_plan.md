# Publishing to Divio.com

This plan outlines the steps to publish your portfolio site to Divio.com. Since Divio is a container-based platform, we have prepared your project with Docker configuration.

## Project Preparation (Completed)
We have added the following files to your project:
- `package.json`: Defines the startup script for Node.js.
- `Dockerfile`: Instructions for Divio to build your site container.
- `docker-compose.yml`: For local testing.
- `.dockerignore`: Keeps the deployment build small.
- `server.js` was updated to be cloud-ready (supports `PORT` env var and binds to `0.0.0.0`).

## Step 1: Create a Project on Divio
1. Log in to the [Divio Control Panel](https://control.divio.com/).
2. Click **Create new project**.
3. Choose a name (e.g., `portfolio-vlad`) and select **Node.js** as the platform.

## Step 2: Connect Your Code
You can either use Divio's Git server or connect your GitHub/GitLab repository.

### Option A: Using Divio's Git Server
1. In your project dashboard, copy the **Git SSH URL**.
2. Run the following commands in your terminal:
   ```powershell
   git add .
   git commit -m "Add Docker and Divio configuration"
   git remote add divio <YOUR_DIVIO_GIT_URL>
   git push divio main
   ```

### Option B: Using GitHub (Recommended)
1. Push your code to a GitHub repository.
2. In Divio's Control Panel, go to **Repository** settings.
3. Link your GitHub account and select the repository.

## Step 3: Deploy
1. Navigate to the **Environments** tab in your Divio project.
2. Click **Deploy** on the **Test** environment.
3. Wait for the build to complete. Divio will automatically detect the `Dockerfile` and build your image.
4. Once finished, click the **Open Site** button to see your live portfolio!
