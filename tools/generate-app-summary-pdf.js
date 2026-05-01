const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const outputDir = path.join(__dirname, '..', 'deliverables');
const outputPath = path.join(outputDir, 'app-summary.pdf');

fs.mkdirSync(outputDir, { recursive: true });

const stream = fs.createWriteStream(outputPath);

const doc = new PDFDocument({
  size: 'LETTER',
  margin: 40,
  info: {
    Title: 'App Summary',
    Author: 'Codex',
    Subject: 'One-page repository summary',
  },
});

doc.pipe(stream);

const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
const left = doc.page.margins.left;
const rightColX = left + 292;
const leftColWidth = 264;
const rightColWidth = pageWidth - 292;

function sectionTitle(text, x, y, width) {
  doc
    .font('Helvetica-Bold')
    .fontSize(10.5)
    .fillColor('#0f172a')
    .text(text.toUpperCase(), x, y, { width });
}

function bodyText(text, x, y, width, options = {}) {
  doc
    .font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(options.size || 8.1)
    .fillColor('#1f2937')
    .text(text, x, y, {
      width,
      lineGap: options.lineGap ?? 1.5,
    });
}

function bulletList(items, x, y, width, options = {}) {
  let cursor = y;
  const bulletIndent = options.bulletIndent || 10;
  const textIndent = options.textIndent || 18;
  const size = options.size || 8.8;

  for (const item of items) {
    doc.font('Helvetica-Bold').fontSize(size).fillColor('#1f2937').text('•', x + bulletIndent, cursor);
    doc
      .font('Helvetica')
      .fontSize(size)
      .fillColor('#1f2937')
      .text(item, x + textIndent, cursor, {
        width: width - textIndent,
        lineGap: options.lineGap ?? 1,
      });
    cursor = doc.y + (options.spacing ?? 2);
  }
  return cursor;
}

doc.rect(0, 0, doc.page.width, 58).fill('#e8f0fe');
doc
  .font('Helvetica-Bold')
  .fontSize(18)
  .fillColor('#0f172a')
  .text('App Summary', left, 18, { width: 220 });
doc
  .font('Helvetica')
  .fontSize(8.6)
  .fillColor('#334155')
  .text('Repo evidence summary for the current application surface', left, 37, {
    width: 320,
  });
doc
  .font('Helvetica-Bold')
  .fontSize(8.6)
  .fillColor('#334155')
  .text('Naming note:', rightColX, 18, { width: rightColWidth });
doc
  .font('Helvetica')
  .fontSize(7.6)
  .fillColor('#475569')
  .text('README says "Espace PMS"; frontend metadata/marketing present "CondoFlow".', rightColX, 30, {
    width: rightColWidth,
    lineGap: 1,
  });

sectionTitle('What It Is', left, 72, leftColWidth);
bodyText(
  'A multi-tenant SaaS for condominium and property operations. Repo evidence shows admin, resident, and superadmin workflows for billing, communication, maintenance, and reporting.',
  left,
  86,
  leftColWidth,
);

sectionTitle("Who It's For", left, 126, leftColWidth);
bodyText(
  'Primary persona: condo association admins or property managers who need one system for buildings, residents, invoices, payments, issues, and resident communication.',
  left,
  140,
  leftColWidth,
);

sectionTitle('What It Does', left, 180, leftColWidth);
bulletList(
  [
    'Manages buildings, apartments, residents, and team access.',
    'Handles invoices, payments, balances, subscriptions, and billing views.',
    'Supports announcements, documents, voting, and resident chat.',
    'Tracks issues, maintenance, suppliers, expenses, and reminders.',
    'Provides imports, reconciliation, reports, audit logs, and onboarding.',
    'Includes superadmin tools for organizations, leads, demos, jobs, and system status.',
  ],
  left,
  194,
  leftColWidth,
  { size: 7.75, spacing: 1, lineGap: 0.5 },
);

sectionTitle('Evidence Gaps', left, 352, leftColWidth);
bodyText(
  'No major required summary item was missing. Branding is mixed across the repo.',
  left,
  366,
  leftColWidth,
  { size: 7.9 },
);

sectionTitle('How It Works', rightColX, 72, rightColWidth);
bulletList(
  [
    'Frontend: Next.js 14 (`frontend`) with `next-intl`, role-based routes, and a shared API client.',
    'Backend: NestJS (`backend`) with feature modules plus global JWT, RBAC, and organization-scope guards.',
    'Data layer: Prisma over PostgreSQL (`schema.prisma` + `docker-compose.yml`).',
    'Realtime/data flow: browser UI -> REST/WebSocket backend -> Prisma -> PostgreSQL; Socket.IO uses org-scoped rooms.',
  ],
  rightColX,
  86,
  rightColWidth,
  { size: 7.7, spacing: 1.1, lineGap: 0.5 },
);

sectionTitle('How To Run', rightColX, 176, rightColWidth);
bulletList(
  [
    'Install dependencies: `npm install`.',
    'Create env files: `cp backend/.env.example backend/.env` and `cp frontend/.env.example frontend/.env.local`.',
    'Start PostgreSQL: `docker compose up -d postgres`.',
    'Initialize DB: `cd backend && npx prisma migrate dev && npx prisma db seed`.',
    'Run both apps: `npm run dev`.',
    'Open `http://localhost:3001`; health: `http://localhost:4000/api/health`.',
  ],
  rightColX,
  190,
  rightColWidth,
  { size: 7.75, spacing: 1.1, lineGap: 0.5 },
);

stream.on('finish', () => {
  console.log(outputPath);
});

doc.end();
