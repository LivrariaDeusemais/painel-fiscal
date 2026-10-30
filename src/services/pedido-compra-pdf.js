const PDFDocument = require('pdfkit');
const path = require('path');
const { lineCents } = require('./reposicao');

const COMPANY = {
  name: 'DEUS É MAIS COMÉRCIO E NEGÓCIOS LTDA',
  cnpj: '18.862.388/0001-03',
  address: 'Rua Bolívia, 733, CASA 03 - Pq das Nações - Santo André/SP - CEP 09280-290',
};
const text = value => String(value ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').trim();
const amount = (value, digits = 2) => Number(value).toLocaleString('pt-BR', {
  minimumFractionDigits: 2, maximumFractionDigits: digits,
});

// Always render the original request, even after receiving the publisher's quote.
function orderPdf(order) {
  if (!order?.lines?.length) throw Error('Pedido sem itens.');
  const lines = order.lines.filter(line => line.quantity > 0);
  if (!lines.length) throw Error('Pedido sem quantidade a comprar.');
  const cents = lines.map(line => lineCents(line));
  const sum = cents.reduce((total, value) => total + value, 0);
  if (!Number.isSafeInteger(sum)) throw Error('Valor total do pedido excede o limite.');
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 34, bufferPages: true,
      info: { Title: `Pedido de compra ${text(order.id)} - ${text(order.supplier)}`,
        Author: COMPANY.name, Subject: 'Solicitação de orçamento à editora' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      const x = 34, width = doc.page.width - x * 2, bottom = doc.page.height - 52;
      const widths = [39, 86, width - 39 - 86 - 34 - 39 - 63 - 66, 34, 39, 63, 66];
      const titles = ['Código', 'Código\nFornecedor', 'Descrição', 'Marca', 'Qt\nComprar', 'Custo unit.', 'Total comprar'];
      const green = '#164E3D', pale = '#E8F1ED', ink = '#283746', border = '#CDDAD3';
      let y;
      const cell = (value, left, top, w, h, options = {}) => {
        doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(options.size || 8)
          .fillColor(options.color || ink).text(text(value), left + 5, top + 6,
            { width: w - 10, height: h - 8, align: options.align || 'left', lineGap: 1, ...options });
      };
      function header() {
        doc.rect(x, 28, width, 31).fill(pale);
        doc.font('Helvetica-Bold').fontSize(15).fillColor(green)
          .text('PEDIDO DE COMPRA', x, 37, { width, align: 'center' });
        doc.image(path.join(__dirname, '../assets/logo-deus-e-mais.png'), x, 77, { fit: [137, 47], align: 'left' });
        doc.font('Helvetica-Bold').fontSize(10).fillColor(ink)
          .text(COMPANY.name, x + 150, 77, { width: width - 150 });
        doc.font('Helvetica').fontSize(8.5)
          .text('CNPJ: ' + COMPANY.cnpj, x + 150, 94, { width: width - 150 })
          .text(COMPANY.address, x + 150, 108, { width: width - 150, lineGap: 2 });
        const supplier = 'Fornecedor: ' + text(order.supplier);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(ink);
        const supplierHeight = Math.max(15, doc.heightOfString(supplier, { width }));
        doc.text(supplier, x, 145, { width });
        y = 145 + supplierHeight + 9;
        doc.rect(x, y, width, 25).fill(pale);
        const date = new Date(order.createdAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        cell(`Pedido de compra nº ${text(order.id)} - Data ${date}`, x, y, width, 25, { bold: true, size: 9 });
        y += 30;
        let left = x;
        for (let i = 0; i < titles.length; i++) {
          doc.rect(left, y, widths[i], 28).fillAndStroke(pale, border);
          // Header labels retain their intentional line breaks.
          doc.font('Helvetica-Bold').fontSize(8).fillColor(green).text(titles[i], left + 4, y + 5,
            { width: widths[i] - 8, height: 23, align: 'center' });
          left += widths[i];
        }
        y += 28;
      }
      header();
      lines.forEach((line, index) => {
        const values = [line.sku, line.code || line.ean || '', line.name,
          line.brand || order.supplier, line.quantity, amount(line.price, 4), amount(cents[index] / 100)];
        const heights = values.map((value, i) => {
          doc.font([1, 4, 6].includes(i) ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
          return doc.heightOfString(text(value), { width: widths[i] - 10, lineGap: 1 }) + 12;
        });
        const height = Math.max(25, ...heights);
        if (height > bottom - 235) throw Error('Descrição do item muito extensa para o pedido PDF.');
        if (y + height > bottom) { doc.addPage(); header(); }
        let left = x;
        for (let i = 0; i < values.length; i++) {
          doc.rect(left, y, widths[i], height).fillAndStroke(index % 2 ? '#F7FAF8' : '#FFFFFF', border);
          cell(values[i], left, y, widths[i], height, { align: i === 2 ? 'left' : i >= 5 ? 'right' : 'center', bold: [1, 4, 6].includes(i) });
          left += widths[i];
        }
        y += height;
      });
      if (y + 74 > bottom) { doc.addPage(); header(); }
      doc.rect(x, y + 5, width, 29).fill(pale);
      const qtyX = x + widths.slice(0, 4).reduce((a, b) => a + b, 0);
      cell('TOTAIS', x, y + 5, qtyX - x, 29, { align: 'right', bold: true, size: 9 });
      cell(lines.reduce((n, line) => n + line.quantity, 0), qtyX, y + 5, widths[4], 29, { align: 'center', bold: true, size: 9 });
      cell(amount(sum / 100), x + width - widths[6], y + 5, widths[6], 29, { align: 'right', bold: true, size: 9 });
      doc.font('Helvetica').fontSize(9).fillColor(ink)
        .text('Favor realizar o orçamento, obrigado.', x, y + 48, { width });
      const pages = doc.bufferedPageRange();
      for (let i = pages.start; i < pages.start + pages.count; i++) {
        doc.switchToPage(i);
        doc.font('Helvetica').fontSize(8).fillColor('#64756D')
          .text(`Pedido ${text(order.id)} - Página ${i + 1} de ${pages.count}`, x, doc.page.height - 47,
            { width, align: 'right', lineBreak: false });
      }
      doc.end();
    } catch (error) { doc.destroy(); reject(error); }
  });
}

module.exports = { orderPdf, COMPANY };
