export const CHART_EVIDENCE_LABEL = 'Chart evidence';

export const hasChartEvidenceSection = (sections = []) => sections.some((section) => String(section).trim().toLowerCase() === CHART_EVIDENCE_LABEL.toLowerCase());

export const activeEvidenceId = (evidence = [], selectedId = null) => evidence.some((item) => item.id === selectedId) ? selectedId : evidence[0]?.id || null;

export const outlineHasVirtualEvidence = (sections = []) => !hasChartEvidenceSection(sections);
