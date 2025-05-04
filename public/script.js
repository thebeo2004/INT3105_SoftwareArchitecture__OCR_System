const form = document.getElementById("uploadForm");
const result = document.getElementById("result");
const fileInput = form.querySelector('input[type="file"]');

function showLoading() {
    const loadingDiv = document.createElement("div");
    loadingDiv.id = "loading";
    loadingDiv.innerHTML = `
        <div class="spinner"></div>
        <p>Processing... Please wait.</p>
    `;
    result.appendChild(loadingDiv);
}

function hideLoading() {
    const loadingDiv = document.getElementById("loading");
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

function resetUI() {
    result.innerHTML = "";
    hideLoading();
}

fileInput.addEventListener("change", () => {
    resetUI(); // Mỗi lần chọn file mới, reset giao diện
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    resetUI();
    showLoading();

    try {
        const response = await fetch("/upload", {
            method: "POST",
            body: formData,
        });

        const data = await response.json();
        hideLoading();

        if (response.ok) {
            const fileNames = data.fileNames;

            result.innerHTML = `
                <p style="color: green;">Successfully processed ${fileNames.length} file(s).</p>
                <button id="downloadButton">Download All Files</button>
            `;

            const downloadButton = document.getElementById("downloadButton");
            downloadButton.addEventListener("click", async () => {
                const upoutputResponse = await fetch("/upoutput", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ fileNames }),
                });

                const upoutputData = await upoutputResponse.json();

                if (upoutputResponse.ok) {
                    upoutputData.filePaths.forEach((filePath) => {
                        const link = document.createElement("a");
                        link.href = `/download/${filePath.split("\\").pop()}`;
                        link.download = filePath.split("\\").pop();
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    });

                    // Sau khi tải xong, hiển thị thông báo thành công
                    result.innerHTML += `<p style="color: green;">Download Successfull!</p>`;
                } else {
                    result.innerHTML = `<p style="color: red;">${upoutputData.message}</p>`;
                }
            });
        } else {
            result.innerHTML = `<p style="color: red;">${data.message}</p>`;
        }
    } catch (err) {
        hideLoading();
        result.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
    }
});
