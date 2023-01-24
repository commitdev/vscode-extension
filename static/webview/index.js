// Import the API, Keyring and some utility functions
const vscode = acquireVsCodeApi();

// Handle message posted from the extension
window.addEventListener("message", (event) => {
    const eventData = event.data;
    const eventCommand = event.command;

    console.log("eventData", eventData);
    console.log("eventCommand", eventCommand);

    switch (eventCommand) {
        case "commit:setProjectId":
            // Update the project id
            const projectIdElm = document.getElementById("project-id");
            projectIdElm.value = eventData;
            break;
        default:
            break;
    }
});

// Add onclick listener to button
window.addEventListener("click", (event) => {
    const projectIdElm = document.getElementById("project-id");
    projectIdElm.value = "test";
});

// // Create onload function
// window.onload = function() {
//     vscode.postMessage({
//         command: "updateProjects",
//     });
// };

// // Button to refresh projects
// const updateProjects = document.getElementById("update-projects");
// // Add onclick listener to button
// updateProjects.addEventListener("click", () => {
//     // Send a message back to the extension
//     vscode.postMessage({
//         command: "updateProjects",
//     });
// });

// // Handle messages sent from the extension to the webview
// window.addEventListener("message", (event) => {
//     const message = event.data; // The JSON data our extension sent
//     switch (message.command) {
//         case "projects":
//             // Update the projects list
//             const projectsElm = document.getElementById("projects-table-body");
//             projectsElm.innerHTML = "";

//             // Load Message JSON String data into an array
//             const projects = JSON.parse(message.data);
//             projects.forEach((project) => {
//                 const row = document.createElement("tr");
//                 row.innerHTML = `
//               <td class="border px-8 py-4">${project.title}</td>
//               <td class="border px-8 py-4">${project.id}</td>
//             `;
//                 // Add classes to the row
//                 row.classList.add("hover:bg-gray-500", "cursor-pointer");
//                 projectsElm.appendChild(row);
//             });
//             break;
//     }
// });