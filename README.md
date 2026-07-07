# 📊 Interactive Entity-Relationship Diagram (ERD)

Welcome to the **Interactive ERD Studio**, a high-performance, responsive, and visually stunning web-based visual database designer! This tool is engineered to help developers, systems architects, and database administrators draft, visualize, and export professional entity-relationship diagrams (ERDs) with extreme ease and precision.

Designed with an immersive dark-theme workspace, customizable fields, automatic smart relationship layout calculations, and dynamic cardinality/totality attributes, ERD Studio makes database modeling simple and fluid.

---

## ✨ Features Highlight

*   **🛠️ Interactive Table Canvas**: Effortlessly add, move, and edit tables. Add primary keys, unique constraints, and nullable modifiers in seconds.
*   **🔗 Smart Connectors**: Draw standard Crow's Foot / Chen notation connections between tables with automatic pathing and self-relationship support.
*   **💎 Relationship Customizer**: Configure cardinality (1:1, 1:M, M:N), participation (total/mandatory, partial), and add attribute blocks directly to connections.
*   **📥 Multi-Mode High-Res Export**:
    *   **Export Entire ERD**: Automatically calculates diagram boundaries, fits everything perfectly, and crops a beautiful 2x high-resolution transparent grid PNG.
    *   **Export Selection**: Manually click and drag to crop and export a custom-defined box on the canvas with pixel-perfect visual fidelity.
*   **💫 Dynamic Space Scaling**: Hand-pan and mouse-zoom the canvas from 10% to 200% with immediate auto-centering and fit-to-screen controls.
*   **💾 Local Auto-Save**: Never lose your progress—your modeling projects are stored automatically in local storage!

---

## 💻 Local Setup & Installation

Follow these quick instructions to get the ERD Studio running on your local machine.

### 🏁 Prerequisites (For Windows Users)

To run this application locally, you will need **Node.js** and **npm** (Node Package Manager).

1.  **Download Node.js**:
    *   Go to the official website: [nodejs.org](https://nodejs.org/).
    *   Download the recommended **LTS (Long Term Support)** installer for Windows (e.g., `.msi` file).
2.  **Install Node.js**:
    *   Double-click the downloaded installer and follow the prompt steps.
    *   Make sure the checkbox for "Automatically install the necessary tools" or adding Node to your `PATH` is enabled.
3.  **Verify Installation**:
    *   Open **Command Prompt** (`cmd`) or **PowerShell** and run:
        ```bash
        node -v
        npm -v
        ```
    *   You should see version numbers printed (e.g., `v18.x.x` and `9.x.x`).

---

### 🚀 Running the Project

Once you have Node.js installed, follow these commands in your project's root folder:

1.  **Extract or Navigate** to the project directory in your terminal:
    ```cmd
    cd path/to/erd-studio
    ```
2.  **Install Dependencies**:
    ```bash
    npm install
    ```
3.  **Start the Development Server**:
    ```bash
    npm run dev
    ```
4.  **Open the Web Application**:
    *   The server will start running locally, typically on `http://localhost:3000`.
    *   Open your favorite browser and navigate to that address to begin modeling!

---

## 📖 How to Use

### 1️⃣ Creating and Modifying Tables (Entities)
*   **Add Table**: Open the left panel, input your desired table name, and click **"+ Create Entity"**.
*   **Add Column/Attribute**: Click **"+ Add Attribute"** inside the table builder. Toggle primary keys (`🔑`), unique constraints (`⭐`), and nullability (`○`) with simple click icons.
*   **Move Columns**: Reorder columns by clicking the **▲ / ▼** buttons or dragging them directly using the handle.

### 2️⃣ Setting Up Relationships
*   Select **Table A** (Source) and **Table B** (Target) in the connection pane, set the relationship name (e.g., *owns*, *manages*), and hit **"Create Relationship"**.
*   Toggle line styles, participation rules (total or partial, marked by single/double lines), and cardinality characters directly.
*   You can drag the relationship **diamond label** or its **attributes box** around the canvas to position them perfectly.

### 3️⃣ Exporting Your Masterpiece
*   **Full Diagram**: Click the **📤 Export Entire ERD** button in the header. The system will fit all active objects, render the canvas grid beautifully, and trigger a sharp, clean `.png` download.
*   **Custom Region**: Click the **✂️ Export Selection** button. The screen will dim—simply click and drag a custom rectangle over the canvas, then click **"Export Selection PNG"** to grab a pixel-perfect snapshot of just that region.

---

## 🛠️ Built With

*   **React 18** & **Vite** (Ultra-fast developer workflow)
*   **TypeScript** (Robust and secure type-safety)
*   **Tailwind CSS** (Clean layouts and animations)
*   **Lucide React** (Vector icons and markers)
*   **html-to-image** & **HTML Canvas API** (Fidelity-first PNG renderings)

Enjoy modeling your databases! If you find this tool helpful, feel free to customize and share it with your team. 🚀
