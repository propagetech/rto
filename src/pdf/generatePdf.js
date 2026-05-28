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

  const aspectRatio = canvas.width / canvas.height;
  const pageAspectRatio = pageWidth / pageHeight;

  let imgWidth;
  let imgHeight;
  if (aspectRatio >= pageAspectRatio) {
    imgWidth = pageWidth;
    imgHeight = pageWidth / aspectRatio;
  } else {
    imgHeight = pageHeight;
    imgWidth = pageHeight * aspectRatio;
  }

  const x = (pageWidth - imgWidth) / 2;
  const y = (pageHeight - imgHeight) / 2;
  pdf.addImage(imgData, "JPEG", x, y, imgWidth, imgHeight);

  return pdf.output("blob");
}
