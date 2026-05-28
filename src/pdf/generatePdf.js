import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

async function waitForFontsToLoad() {
  if (document.fonts && document.fonts.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
  }
}

export async function generatePdfFromElement(element) {
  if (!element) throw new Error("PDF template element not found");

  await waitForFontsToLoad();

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight
  });

  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const overflowMm = 3;

  if (imgHeight <= pageHeight + overflowMm) {
    const fitted = Math.min(imgHeight, pageHeight);
    pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, fitted);
  } else {
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
  }

  return pdf.output("blob");
}
