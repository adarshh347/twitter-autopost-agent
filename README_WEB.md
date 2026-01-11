# Twitter Automation Web App (V1)

This project consists of a **FastAPI Backend** and a **Next.js Frontend**.

## Prerequisites
- Python 3.10+
- Node.js 18+

## 1. Backend Setup

The backend handles the automation logic and browser control.

1.  **Install Dependencies:**
    ```bash
    pip install fastapi uvicorn python-multipart python-jose passlib bcrypt selenium webdriver-manager pydantic
    ```

2.  **Run the Backend:**
    From the root directory (`twitter-automation-ai/`):
    ```bash
    uvicorn backend.api:app --reload --port 8000
    ```
    The API will be available at `http://localhost:8000`.
    Swagger Docs: `http://localhost:8000/docs`.

## 2. Frontend Setup

The frontend provides the user interface.

1.  **Navigate to frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install Dependencies (if not already done):**
    ```bash
    npm install
    ```
    *Plus some UI libraries we recommend:*
    ```bash
    npm install lucid-react axios clsx tailwind-merge framer-motion
    ```

3.  **Run the Frontend:**
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:3000`.

## 3. How to Connect Your Account (Cookies)

Since Twitter automation requires cookies, and you are running this locally:

1.  Go to the Web App → **Connect** page.
2.  Click **"Launch Login Browser"**.
3.  A Chrome window will open on your computer.
4.  **Log in to Twitter** manually in that window.
5.  Once logged in, go back to the Web App and click **"Save Session"**.
6.  The system will grab your cookies and save them. You can now use the automation features!

## Features

- **Profile**: View your stats and recent tweets.
- **Compose**: Post tweets with text and images.
- **Actions**: Delete tweets (via ID), Retweet/Quote (via URL).
