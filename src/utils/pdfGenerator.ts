import { jsPDF } from 'jspdf';
import { AnalyzeResponse, RelevantFile, CodeFlowStep, EvidenceItem } from '@/server/schemas/analyzeSchema.ts';

export function generateReportPdf(data: AnalyzeResponse) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawHeaderFooter();
    }
  };

  const drawHeaderFooter = () => {
    const pageCount = (doc.internal as any).getNumberOfPages();
    // Running footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `RepoLens AI Contribution Report • ${data.repository.owner}/${data.repository.name} • Commit ${data.repository.commitSha.slice(0, 8)}`,
      margin,
      pageHeight - 20
    );
    doc.text(`Page ${pageCount}`, pageWidth - margin - 35, pageHeight - 20);
  };

  // --- Header ---
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, contentWidth, 54, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(248, 250, 252);
  doc.text('RepoLens AI — Contribution Analysis Report', margin + 14, y + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated on ${new Date().toLocaleDateString()} • Evidence-Backed Guide for Open Source Contributors`,
    margin + 14,
    y + 42
  );

  y += 68;

  // --- Repository Snapshot ---
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 60, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, 60, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  const starsText = data.repository.stars ? ` (${data.repository.stars.toLocaleString()} stars)` : '';
  doc.text(`Target: ${data.repository.owner}/${data.repository.name}${starsText}`, margin + 12, y + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Language: ${data.repository.primaryLanguage}   |   Branch: ${data.repository.defaultBranch}   |   Pinned Commit: ${data.repository.commitSha}`, margin + 12, y + 33);
  doc.text(`Fit Level: ${data.contributionFit.level.toUpperCase()}   |   Effort: ${data.contributionFit.effortEstimate || '1–2 hours'}   |   Stack: ${data.repository.technologies.join(', ') || 'Standard'}`, margin + 12, y + 48);

  y += 75;

  // --- Issue Breakdown ---
  checkPageBreak(70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Issue Summary & Analysis', margin, y);
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(data.issueAnalysis.summary, margin, y);
  y += 16;

  if (data.issueAnalysis.expectedBehavior) {
    checkPageBreak(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Expected Behavior:', margin, y);
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const lines = doc.splitTextToSize(data.issueAnalysis.expectedBehavior, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 10 + 6;
  }

  if (data.issueAnalysis.actualBehavior) {
    checkPageBreak(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Actual Behavior / Observed Stacktrace:', margin, y);
    y += 12;
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(data.issueAnalysis.actualBehavior, contentWidth);
    doc.text(lines, margin, y);
    y += lines.length * 10 + 10;
  }

  // --- Ranked Candidate Files & Evidence ---
  checkPageBreak(60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Where to Look (Ranked Candidate Files & Evidence)', margin, y);
  y += 16;

  data.relevantFiles.forEach((file: RelevantFile, idx: number) => {
    checkPageBreak(80);
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, y, contentWidth, 20, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, contentWidth, 20, 'S');

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`${idx + 1}. ${file.path}`, margin + 8, y + 13);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const badgeText = `[${file.confidence.toUpperCase()} CONFIDENCE • ${file.verified ? 'VERIFIED IN TREE' : 'UNVERIFIED'}]`;
    doc.setTextColor(file.confidence === 'high' ? 16 : 180, file.confidence === 'high' ? 185 : 83, file.confidence === 'high' ? 129 : 9);
    doc.text(badgeText, pageWidth - margin - 190, y + 13);

    y += 26;

    // Reason
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    const reasonLines = doc.splitTextToSize(`Reason: ${file.reason}`, contentWidth - 10);
    doc.text(reasonLines, margin + 6, y);
    y += reasonLines.length * 10 + 4;

    // Evidence quotes
    if (file.evidence && file.evidence.length > 0) {
      file.evidence.forEach((ev: EvidenceItem) => {
        checkPageBreak(35);
        doc.setFillColor(241, 245, 249);
        doc.rect(margin + 6, y, contentWidth - 12, 24, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(margin + 6, y, contentWidth - 12, 24, 'S');

        doc.setFont('courier', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`L${ev.startLine}–L${ev.endLine}:`, margin + 12, y + 11);

        doc.setFont('courier', 'normal');
        doc.setTextColor(15, 23, 42);
        const quoteSnippet = ev.quote.length > 80 ? ev.quote.slice(0, 80) + '...' : ev.quote;
        doc.text(quoteSnippet, margin + 60, y + 11);

        if (ev.permalink) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(6.5);
          doc.setTextColor(37, 99, 235);
          doc.text(ev.permalink, margin + 12, y + 20);
        }

        y += 28;
      });
    }

    y += 8;
  });

  // --- Code Flow Pipeline ---
  checkPageBreak(70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('3. Observed Code Execution Flow', margin, y);
  y += 14;

  data.codeFlow.forEach((step: CodeFlowStep, idx: number) => {
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`${idx + 1}.`, margin + 4, y);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const stepLines = doc.splitTextToSize(step.step, contentWidth - 25);
    doc.text(stepLines, margin + 20, y);
    y += stepLines.length * 9 + 4;

    if (step.path) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`   Location: ${step.path} ${step.startLine !== null ? `(Lines ${step.startLine}–${step.endLine})` : ''}`, margin + 20, y);
      y += 10;
    }
  });

  y += 10;

  // --- Investigation Plan & Testing Checklist ---
  checkPageBreak(90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('4. Investigation Plan & Testing Recommendations', margin, y);
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text('Actionable Investigation Steps:', margin, y);
  y += 12;

  data.investigationPlan.forEach((step: string, idx: number) => {
    checkPageBreak(25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(`• ${step}`, contentWidth - 10);
    doc.text(lines, margin + 8, y);
    y += lines.length * 9 + 3;
  });

  y += 8;
  checkPageBreak(60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text('Testing Checklist:', margin, y);
  y += 12;

  data.testingChecklist.existingTestsToInspect.forEach((t: string) => {
    checkPageBreak(18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(`[ ] Inspect Test: ${t}`, margin + 8, y);
    y += 11;
  });

  data.testingChecklist.edgeCases.forEach((e: string) => {
    checkPageBreak(18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(`[ ] Edge Case: ${e}`, margin + 8, y);
    y += 11;
  });

  // Suggested commands
  if (data.testingChecklist.commandsToTry.length > 0) {
    checkPageBreak(30);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Commands: ${data.testingChecklist.commandsToTry.join('   |   ')}`, margin + 8, y);
    y += 16;
  }

  // --- Draft PR Kit ---
  checkPageBreak(90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('5. Draft Pull Request Kit (DRAFT - Edit Before Submitting)', margin, y);
  y += 14;

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, 75, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, 75, 'S');

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`Branch: ${data.prKit.branchName}`, margin + 10, y + 15);
  doc.text(`Commit: ${data.prKit.commitMessage}`, margin + 10, y + 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  const prSnippet = data.prKit.prDescriptionDraft.replace(/\n+/g, ' ').slice(0, 140) + '...';
  doc.text(`PR Outline: ${prSnippet}`, margin + 10, y + 46);
  doc.setTextColor(180, 83, 9);
  doc.text(`Notice: ${data.prKit.disclaimer}`, margin + 10, y + 62);

  y += 85;

  // --- Honesty Panel ---
  checkPageBreak(80);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('6. Evidence Grounding & Honesty Disclosures', margin, y);
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(16, 185, 129);
  doc.text('Verified Facts:', margin, y);
  y += 10;
  data.honesty.verifiedFacts.forEach((f: string) => {
    checkPageBreak(18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(`✓ ${f}`, contentWidth - 10);
    doc.text(lines, margin + 8, y);
    y += lines.length * 9 + 2;
  });

  y += 6;
  checkPageBreak(40);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(217, 119, 6);
  doc.text('Hypotheses (Inferred / Unproven):', margin, y);
  y += 10;
  data.honesty.hypotheses.forEach((h: string) => {
    checkPageBreak(18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(`? ${h}`, contentWidth - 10);
    doc.text(lines, margin + 8, y);
    y += lines.length * 9 + 2;
  });

  // Final footer stamp
  drawHeaderFooter();

  // Save PDF
  const filename = `repolens-${data.repository.owner}-${data.repository.name}-report.pdf`;
  doc.save(filename);
}
