import jsPDF from "jspdf";

type PDFOrder = {
  id?: string;
  status?: string;
  reported_issue?: string;
  services_performed?: string;
  employee_name?: string;
  value?: number | string;
  delivery_date?: string;
  notes?: string;
  created_at?: string;
};

type PDFClient = {
  name?: string;
  phone?: string;
  whatsapp?: string;
};

type PDFVehicle = {
  plate?: string;
  brand?: string;
  model?: string;
  year?: string | number;
  color?: string;
};

type PDFWorkshop = {
  workshop_name?: string;
  owner_name?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  state?: string;
  logo_url?: string;
};

const money = (value?: number | string) => {
  const n = Number(value || 0);
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const dateBR = (value?: string) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR");
};

const statusLabel = (status?: string) => {
  const map: Record<string, string> = {
    aguardando: "Aguardando",
    em_manutencao: "Em manutenção",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
  };

  return map[status || ""] || status || "-";
};

function sectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFillColor(20, 20, 24);
  doc.roundedRect(14, y, 182, 9, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(title, 18, y + 6);
}

function labelValue(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
) {
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(label, x, y);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(value || "-", x, y + 5);
}

async function imageToDataUrl(url?: string) {
  if (!url) return null;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;

      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Não foi possível carregar a logo no PDF:", error);
    return null;
  }
}


type PDFBudgetItem = {
  description: string;
  value: string | number;
};

type PDFBudgetDetails = {
  payment_method?: string;
  payment_details?: string;
  validity?: string;
  client_note?: string;
  internal_note?: string;
  parts?: PDFBudgetItem[];
  labor?: PDFBudgetItem[];
};

function drawWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 5) {
  const lines = doc.splitTextToSize(text || '-', maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function drawBudgetItems(doc: jsPDF, title: string, items: PDFBudgetItem[] | undefined, x: number, y: number, width: number) {
  const safeItems = (items || []).filter((item) => item.description || Number(item.value || 0) > 0);
  doc.setTextColor(255, 80, 80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(title, x, y);

  let currentY = y + 7;
  if (!safeItems.length) {
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('-', x, currentY);
    return currentY + 6;
  }

  for (const item of safeItems) {
    doc.setTextColor(35, 35, 35);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(item.description || '-', width - 45);
    doc.text(lines, x, currentY);
    doc.setFont('helvetica', 'bold');
    doc.text(money(item.value), x + width, currentY, { align: 'right' });
    currentY += Math.max(6, lines.length * 5);
  }
  return currentY + 3;
}

export async function generateBudgetPDF({
  order,
  client,
  vehicle,
  workshop,
  details = {},
}: {
  order: PDFOrder;
  client: PDFClient;
  vehicle: PDFVehicle;
  workshop: PDFWorkshop;
  details?: PDFBudgetDetails;
}) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const logoDataUrl = await imageToDataUrl(workshop?.logo_url);

  doc.setFillColor(247, 247, 248);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setFillColor(12, 12, 14);
  doc.rect(0, 0, 210, 42, 'F');

  let headerTextX = 14;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 14, 9, 18, 18);
      headerTextX = 36;
    } catch (error) {
      console.warn('Erro ao adicionar logo no PDF:', error);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(workshop?.workshop_name || 'Vortan Oficina', headerTextX, 17);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(190, 190, 190);
  doc.text('Orçamento profissional', headerTextX, 25);

  doc.setTextColor(255, 80, 80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`ORÇAMENTO #${order?.id?.slice(0, 8) || '-'}`, pageWidth - 14, 17, { align: 'right' });

  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.text(`Criado em ${dateBR(order?.created_at)}`, pageWidth - 14, 25, { align: 'right' });

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 50, 182, 28, 3, 3, 'F');
  labelValue(doc, 'CLIENTE', client?.name || '-', 20, 60);
  labelValue(doc, 'VEÍCULO', `${vehicle?.brand || ''} ${vehicle?.model || ''}`.trim(), 82, 60);
  labelValue(doc, 'PLACA', vehicle?.plate || '-', 145, 60);

  sectionTitle(doc, 'DADOS DO ORÇAMENTO', 88);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 100, 182, 36, 3, 3, 'F');

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Solicitação do cliente', 20, 111);
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  drawWrappedText(doc, order?.reported_issue || '-', 20, 117, 168);

  sectionTitle(doc, 'PEÇAS E MÃO DE OBRA', 146);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 158, 182, 67, 3, 3, 'F');
  let itemsY = drawBudgetItems(doc, 'PEÇAS', details.parts, 20, 170, 168);
  itemsY = Math.max(itemsY, 190);
  drawBudgetItems(doc, 'MÃO DE OBRA / SERVIÇOS', details.labor, 20, itemsY, 168);

  sectionTitle(doc, 'CONDIÇÕES COMERCIAIS', 235);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 247, 182, 30, 3, 3, 'F');

  const payment = `${details.payment_method || '-'}${details.payment_details ? ` • ${details.payment_details}` : ''}`;
  labelValue(doc, 'Condições de pagamento', payment, 20, 258);
  labelValue(doc, 'Validade do orçamento', details.validity || '-', 20, 271);

  doc.setTextColor(255, 80, 80);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(money(order?.value), 190, 265, { align: 'right' });
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.text('VALOR TOTAL', 190, 254, { align: 'right' });

  if (details.client_note) {
    doc.addPage();
    doc.setFillColor(247, 247, 248);
    doc.rect(0, 0, 210, 297, 'F');
    sectionTitle(doc, 'OBSERVAÇÕES AO CLIENTE', 20);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(14, 32, 182, 42, 3, 3, 'F');
    doc.setTextColor(30, 30, 30);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(doc.splitTextToSize(details.client_note, 168), 20, 42);
  }

  doc.setTextColor(130, 130, 130);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Gerado por Vortan Oficina • By Vortan Systems', pageWidth / 2, 288, { align: 'center' });

  doc.save(`orcamento-${vehicle?.plate || order?.id || 'vortan'}.pdf`);
}

export async function generateOrderPDF({
  order,
  client,
  vehicle,
  workshop,
}: {
  order: PDFOrder;
  client: PDFClient;
  vehicle: PDFVehicle;
  workshop: PDFWorkshop;
}) {
  const doc = new jsPDF("p", "mm", "a4");

  const pageWidth = doc.internal.pageSize.getWidth();

  const logoDataUrl = await imageToDataUrl(workshop?.logo_url);

  // Fundo
  doc.setFillColor(247, 247, 248);
  doc.rect(0, 0, 210, 297, "F");

  // Header premium
  doc.setFillColor(12, 12, 14);
  doc.rect(0, 0, 210, 38, "F");

  let headerTextX = 14;

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", 14, 9, 18, 18);
      headerTextX = 36;
    } catch (error) {
      console.warn("Erro ao adicionar logo no PDF:", error);
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(workshop?.workshop_name || "Vortan Oficina", headerTextX, 17);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(190, 190, 190);
  doc.text("Ordem de Serviço", headerTextX, 25);

  doc.setTextColor(255, 80, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(`OS #${order?.id?.slice(0, 8) || "-"}`, pageWidth - 14, 17, {
    align: "right",
  });

  doc.setFontSize(9);
  doc.setTextColor(220, 220, 220);
  doc.text(statusLabel(order?.status), pageWidth - 14, 25, {
    align: "right",
  });

  // Card resumo
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 46, 182, 27, 3, 3, "F");

  labelValue(doc, "CLIENTE", client?.name || "-", 20, 56);
  labelValue(
    doc,
    "VEÍCULO",
    `${vehicle?.brand || ""} ${vehicle?.model || ""}`.trim(),
    82,
    56,
  );
  labelValue(doc, "PLACA", vehicle?.plate || "-", 145, 56);

  // Cliente
  sectionTitle(doc, "DADOS DO CLIENTE", 82);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 94, 182, 24, 3, 3, "F");

  labelValue(doc, "Nome", client?.name || "-", 20, 104);
  labelValue(
    doc,
    "Telefone",
    client?.phone || client?.whatsapp || "-",
    100,
    104,
  );

  // Veículo
  sectionTitle(doc, "DADOS DO VEÍCULO", 127);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 139, 182, 32, 3, 3, "F");

  labelValue(doc, "Marca", vehicle?.brand || "-", 20, 149);
  labelValue(doc, "Modelo", vehicle?.model || "-", 70, 149);
  labelValue(doc, "Ano", String(vehicle?.year || "-"), 120, 149);
  labelValue(doc, "Cor", vehicle?.color || "-", 155, 149);

  labelValue(doc, "Placa", vehicle?.plate || "-", 20, 162);

  // Serviço
  sectionTitle(doc, "SERVIÇO", 180);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 192, 182, 54, 3, 3, "F");

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Problema relatado", 20, 202);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(order?.reported_issue || "-", 168), 20, 208);

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Serviços executados", 20, 225);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(order?.services_performed || "-", 168), 20, 231);

  // Rodapé de informações
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, 254, 182, 22, 3, 3, "F");

  labelValue(doc, "Funcionário", order?.employee_name || "-", 20, 264);
  labelValue(doc, "Entrega prevista", dateBR(order?.delivery_date), 82, 264);

  doc.setTextColor(255, 80, 80);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(money(order?.value), 190, 267, { align: "right" });

  // Rodapé final
  doc.setTextColor(130, 130, 130);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Gerado por Vortan Oficina • By Vortan Systems",
    pageWidth / 2,
    288,
    { align: "center" },
  );

  doc.save(`ordem-servico-${vehicle?.plate || order?.id || "vortan"}.pdf`);
}
