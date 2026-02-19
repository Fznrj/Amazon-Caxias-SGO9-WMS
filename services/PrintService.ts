
export interface PalletLabelData {
    palletId: string;
    origin: string;
    destination: string;
    date: string;
    packageCount: number;
}

export const PrintService = {
    printPalletLabel: (data: PalletLabelData) => {
        const qrContent = data.palletId;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrContent)}`;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const html = `
            <html>
                <head>
                    <title>Impressão de Etiqueta - ${data.palletId}</title>
                    <style>
                        @page {
                            size: 100mm 150mm;
                            margin: 0;
                        }
                        body {
                            font-family: 'Arial', sans-serif;
                            margin: 0;
                            padding: 10mm;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            text-align: center;
                            color: black;
                            background: white;
                        }
                        .qr-code {
                            width: 60mm;
                            height: 60mm;
                            margin-bottom: 5mm;
                        }
                        .pallet-id {
                            font-size: 14pt;
                            font-weight: bold;
                            margin-bottom: 2mm;
                        }
                        .route {
                            font-size: 12pt;
                            margin-bottom: 4mm;
                        }
                        .destination {
                            font-size: 32pt;
                            font-weight: 900;
                            margin-bottom: 6mm;
                            border-top: 2px solid black;
                            border-bottom: 2px solid black;
                            padding: 2mm 0;
                            width: 100%;
                        }
                        .footer-info {
                            font-size: 10pt;
                            width: 100%;
                            display: flex;
                            flex-direction: column;
                            gap: 2mm;
                        }
                        .cpt {
                            font-weight: bold;
                        }
                        .packages {
                            font-size: 11pt;
                        }
                        @media print {
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    <img src="${qrUrl}" class="qr-code" />
                    <div class="pallet-id">${data.palletId}</div>
                    <div class="route">${data.origin} -> ${data.destination}</div>
                    <div class="destination">${data.destination}</div>
                    <div class="footer-info">
                        <div class="cpt">CPT: ${data.date}</div>
                        <div class="packages">Number of packages: ${data.packageCount}</div>
                    </div>
                    <script>
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                                window.close();
                            }, 500);
                        };
                    </script>
                </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    }
};
