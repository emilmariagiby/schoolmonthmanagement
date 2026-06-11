import * as XLSX from 'xlsx';

export interface RawRosterRow {
  Name?: string | number;
  Class?: string | number;
  Section?: string | number;
  'Mobile No'?: string | number;
  'Parent Email'?: string | number;
}

export interface ParsedStudent {
  name: string;
  class: string;
  section: string;
  mobile_no: string;
  parent_email: string;
  rowNumber: number;
}

export interface RawReportRow {
  'Mobile No'?: string | number;
  'Subject 1 Score'?: string | number;
  'Subject 2 Score'?: string | number;
  'Subject 3 Score'?: string | number;
  'Subject 4 Score'?: string | number;
  'Subject 5 Score'?: string | number;
  'Lab Attendance'?: string | number;
  'Discipline'?: string | number;
  'Class Teacher Remark'?: string | number;
}

export interface ParsedReport {
  mobile_no: string;
  subject_1_score: number;
  subject_2_score: number;
  subject_3_score: number;
  subject_4_score: number;
  subject_5_score: number;
  lab_attendance: number;
  discipline: string;
  class_teacher_remark: string;
  rowNumber: number;
}

export interface ImportError {
  row: number;
  message: string;
}

/**
 * Parses and validates an Excel sheet containing student roster details.
 */
export const parseStudentRoster = (fileData: ArrayBuffer): { data: ParsedStudent[]; errors: ImportError[] } => {
  const workbook = XLSX.read(fileData, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData: RawRosterRow[] = XLSX.utils.sheet_to_json(sheet);

  const data: ParsedStudent[] = [];
  const errors: ImportError[] = [];

  rawData.forEach((row, index) => {
    const rowNumber = index + 2; // Excel rows are 1-indexed and have headers
    const name = String(row.Name || '').trim();
    const studentClass = String(row.Class || '').trim();
    const section = String(row.Section || '').trim();
    const mobileNo = String(row['Mobile No'] || '').trim();
    const parentEmail = String(row['Parent Email'] || '').trim();

    if (!name) {
      errors.push({ row: rowNumber, message: 'Name is required' });
      return;
    }
    if (!studentClass) {
      errors.push({ row: rowNumber, message: 'Class is required' });
      return;
    }
    if (!section) {
      errors.push({ row: rowNumber, message: 'Section is required' });
      return;
    }
    if (!mobileNo) {
      errors.push({ row: rowNumber, message: 'Mobile No is required' });
      return;
    }
    if (!parentEmail || !parentEmail.includes('@')) {
      errors.push({ row: rowNumber, message: 'A valid Parent Email is required' });
      return;
    }

    data.push({
      name,
      class: studentClass,
      section,
      mobile_no: mobileNo,
      parent_email: parentEmail,
      rowNumber,
    });
  });

  return { data, errors };
};

/**
 * Parses and validates an Excel sheet containing student report cards.
 */
export const parsePerformanceReports = (fileData: ArrayBuffer): { data: ParsedReport[]; errors: ImportError[] } => {
  const workbook = XLSX.read(fileData, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData: RawReportRow[] = XLSX.utils.sheet_to_json(sheet);

  const data: ParsedReport[] = [];
  const errors: ImportError[] = [];

  rawData.forEach((row, index) => {
    const rowNumber = index + 2;
    const mobileNo = String(row['Mobile No'] || '').trim();
    const s1 = parseFloat(String(row['Subject 1 Score'] ?? '-1'));
    const s2 = parseFloat(String(row['Subject 2 Score'] ?? '-1'));
    const s3 = parseFloat(String(row['Subject 3 Score'] ?? '-1'));
    const s4 = parseFloat(String(row['Subject 4 Score'] ?? '-1'));
    const s5 = parseFloat(String(row['Subject 5 Score'] ?? '-1'));
    const labAtt = parseFloat(String(row['Lab Attendance'] ?? '-1'));
    const discipline = String(row.Discipline || '').trim();
    const remark = String(row['Class Teacher Remark'] || '').trim();

    if (!mobileNo) {
      errors.push({ row: rowNumber, message: 'Mobile No is required for student mapping' });
      return;
    }

    const validateScore = (score: number, fieldName: string): boolean => {
      if (isNaN(score) || score < 0 || score > 100) {
        errors.push({ row: rowNumber, message: `${fieldName} must be a number between 0 and 100` });
        return false;
      }
      return true;
    };

    const isScoresValid =
      validateScore(s1, 'Subject 1 Score') &&
      validateScore(s2, 'Subject 2 Score') &&
      validateScore(s3, 'Subject 3 Score') &&
      validateScore(s4, 'Subject 4 Score') &&
      validateScore(s5, 'Subject 5 Score') &&
      validateScore(labAtt, 'Lab Attendance');

    if (!isScoresValid) return;

    if (!discipline) {
      errors.push({ row: rowNumber, message: 'Discipline assessment is required' });
      return;
    }

    data.push({
      mobile_no: mobileNo,
      subject_1_score: s1,
      subject_2_score: s2,
      subject_3_score: s3,
      subject_4_score: s4,
      subject_5_score: s5,
      lab_attendance: labAtt,
      discipline,
      class_teacher_remark: remark,
      rowNumber,
    });
  });

  return { data, errors };
};
