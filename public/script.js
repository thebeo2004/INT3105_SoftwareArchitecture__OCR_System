const form = document.getElementById("uploadForm");
const result = document.getElementById("result");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();

        if (response.ok) {
            result.innerHTML = `
                <p style="color: green;">${data.message}</p>
                <button id="downloadButton">Download Processed PDF</button>
            `;

            // Add event listener to the download button
            const downloadButton = document.getElementById("downloadButton");
            downloadButton.addEventListener("click", async () => {
                const upoutputResponse = await fetch("/upoutput", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ fileName: data.fileName }),
                });
                console.log("Sending fileName to /upoutput:", data.fileName);

                const upoutputData = await upoutputResponse.json();

                if (upoutputResponse.ok) {
                    // Redirect to the file path for download
                    window.location.href = `/download/${data.fileName}`;
                } else {
                    result.innerHTML = `<p style="color: red;">${upoutputData.message}</p>`;
                }
            });
        } else {
            result.innerHTML = `<p style="color: red;">${data.message}</p>`;
        }
    } catch (err) {
        result.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
    }
});
