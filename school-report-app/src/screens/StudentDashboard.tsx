import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { supabase } from '../lib/supabaseClient';
import { COLORS, THEME, WINDOW_WIDTH } from '../theme';

interface StudentDashboardProps {
  session: any;
  onLogout: () => void;
}

const PERIODS = [
  { key: 'MAY_TO_JUNE', label: 'May - June' },
  { key: 'AUGUST_TO_SEPTEMBER', label: 'Aug - Sept' },
  { key: 'OCT_TO_NOVEMBER', label: 'Oct - Nov' },
  { key: 'DECEMBER_TO_JANUARY', label: 'Dec - Jan' },
  { key: 'FEB', label: 'February' },
];

export default function StudentDashboard({ session, onLogout }: StudentDashboardProps) {
  const [studentProfile, setStudentProfile] = useState<any>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('MAY_TO_JUNE');
  const [report, setReport] = useState<any>(null);
  const [principalSig, setPrincipalSig] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);

  useEffect(() => {
    fetchData();
  }, [selectedPeriod]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const userId = session.user.id;

      // 1. Fetch Student Profile
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileErr) throw profileErr;
      setStudentProfile(profile);

      // 2. Fetch System Settings (for Principal Signature)
      const { data: systemSettings, error: settingsErr } = await supabase
        .from('system_settings')
        .select('principal_signature_url')
        .eq('id', '00000000-0000-0000-0000-000000000000')
        .single();

      if (!settingsErr && systemSettings) {
        setPrincipalSig(systemSettings.principal_signature_url);
      }

      // 3. Fetch Student Report for selected period
      const { data: reportData, error: reportErr } = await supabase
        .from('reports')
        .select('*, created_by(name, signature_url)')
        .eq('student_id', userId)
        .eq('period', selectedPeriod)
        .maybeSingle();

      if (reportErr) throw reportErr;
      setReport(reportData);
    } catch (err: any) {
      console.error('Error fetching student dashboard data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!report || !studentProfile) {
      Alert.alert('No Report Data', 'There is no report card data to export for this period.');
      return;
    }

    setExporting(true);
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #1f2937;
              padding: 40px;
              line-height: 1.5;
            }
            .header-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .title-section {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 2px solid #8A5CFF;
              padding-bottom: 20px;
            }
            .title-section h1 {
              font-size: 28px;
              color: #111827;
              margin: 0;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .title-section p {
              color: #6b7280;
              margin: 5px 0 0 0;
              font-size: 14px;
            }
            .info-grid {
              width: 100%;
              margin-bottom: 30px;
            }
            .info-label {
              font-weight: bold;
              color: #4b5563;
              padding: 8px 15px;
              background-color: #f3f4f6;
              width: 20%;
            }
            .info-value {
              padding: 8px 15px;
              border: 1px solid #e5e7eb;
              width: 30%;
            }
            .report-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            .report-table th {
              background-color: #8A5CFF;
              color: white;
              font-weight: bold;
              text-align: left;
              padding: 12px;
            }
            .report-table td {
              border: 1px solid #e5e7eb;
              padding: 12px;
            }
            .report-table tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .metric-card {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 15px;
              margin-bottom: 20px;
              background-color: #f9fafb;
            }
            .metric-title {
              font-weight: bold;
              margin-bottom: 5px;
              color: #4b5563;
            }
            .signature-container {
              margin-top: 60px;
              display: flex;
              justifyContent: space-between;
            }
            .signature-block {
              text-align: center;
              width: 45%;
            }
            .signature-img {
              max-height: 80px;
              max-width: 180px;
              margin-bottom: 10px;
            }
            .signature-line {
              border-top: 1px dashed #9ca3af;
              margin-top: 10px;
              padding-top: 5px;
              font-weight: bold;
              color: #4b5563;
            }
          </style>
        </head>
        <body>
          <div class="title-section">
            <h1>Monthly Performance Report Card</h1>
            <p>Academic Year 2026-2027</p>
          </div>

          <table class="info-grid" style="border-collapse: collapse;">
            <tr>
              <td class="info-label">Student Name</td>
              <td class="info-value">${studentProfile?.name}</td>
              <td class="info-label">Reporting Period</td>
              <td class="info-value">${PERIODS.find((p) => p.key === selectedPeriod)?.label}</td>
            </tr>
            <tr>
              <td class="info-label">Class & Section</td>
              <td class="info-value">Grade ${studentProfile?.class} - ${studentProfile?.section}</td>
              <td class="info-label">Mobile No</td>
              <td class="info-value">${studentProfile?.mobile_no}</td>
            </tr>
          </table>

          <table class="report-table">
            <thead>
              <tr>
                <th>Subject Name</th>
                <th style="width: 30%; text-align: right;">Score Obtained (out of 100)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${report?.subject_1_name}</td>
                <td style="text-align: right; font-weight: bold;">${report?.subject_1_score}%</td>
              </tr>
              <tr>
                <td>${report?.subject_2_name}</td>
                <td style="text-align: right; font-weight: bold;">${report?.subject_2_score}%</td>
              </tr>
              <tr>
                <td>${report?.subject_3_name}</td>
                <td style="text-align: right; font-weight: bold;">${report?.subject_3_score}%</td>
              </tr>
              <tr>
                <td>${report?.subject_4_name}</td>
                <td style="text-align: right; font-weight: bold;">${report?.subject_4_score}%</td>
              </tr>
              <tr>
                <td>${report?.subject_5_name}</td>
                <td style="text-align: right; font-weight: bold;">${report?.subject_5_score}%</td>
              </tr>
            </tbody>
          </table>

          <div class="metric-card">
            <div class="metric-title">Lab Attendance</div>
            <div>${report?.lab_attendance}% of scheduled lab hours attended.</div>
          </div>

          <div class="metric-card">
            <div class="metric-title">Discipline Rating</div>
            <div style="font-weight: bold; color: #8A5CFF;">${report?.discipline}</div>
          </div>

          <div class="metric-card">
            <div class="metric-title">Class Teacher Remarks</div>
            <div style="font-style: italic;">"${report?.class_teacher_remark || 'No remark entered.'}"</div>
          </div>

          <div class="signature-container">
            <div class="signature-block">
              ${
                report?.created_by?.signature_url
                  ? `<img class="signature-img" src="${report.created_by.signature_url}" alt="Teacher Signature" />`
                  : `<div style="height: 80px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-style: italic;">Image Not Uploaded</div>`
              }
              <div class="signature-line">Class Teacher Signature</div>
              <div style="font-size: 12px; color: #6b7280;">(${report?.created_by?.name || 'Instructor'})</div>
            </div>
            <div class="signature-block">
              ${
                principalSig
                  ? `<img class="signature-img" src="${principalSig}" alt="Principal Signature" />`
                  : `<div style="height: 80px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-style: italic;">Image Not Uploaded</div>`
              }
              <div class="signature-line">Principal Signature</div>
              <div style="font-size: 12px; color: #6b7280;">Global settings signature</div>
            </div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (err: any) {
      Alert.alert('Export Error', err.message || 'Could not export report to PDF.');
    } finally {
      setExporting(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return COLORS.success;
    if (score >= 40) return COLORS.warning;
    return COLORS.danger;
  };

  return (
    <View style={THEME.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.studentName}>{studentProfile?.name || 'Student'}</Text>
          <Text style={styles.studentMeta}>
            Grade {studentProfile?.class} - Section {studentProfile?.section} | Mobile: {studentProfile?.mobile_no}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Period Selection Carousel */}
      <View style={styles.periodPickerContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodScroll}>
          {PERIODS.map((period) => {
            const isSelected = selectedPeriod === period.key;
            return (
              <TouchableOpacity
                key={period.key}
                style={[styles.periodTab, isSelected && styles.periodTabActive]}
                onPress={() => setSelectedPeriod(period.key)}
              >
                <Text style={[styles.periodTabText, isSelected && styles.periodTabTextActive]}>
                  {period.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
          <Text style={styles.loadingText}>Loading performance records...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
          {report ? (
            <>
              {/* Performance Scores Card */}
              <View style={THEME.glassCard}>
                <Text style={THEME.cardTitle}>Academic Subject Scores</Text>
                
                {[
                  { name: report.subject_1_name, score: report.subject_1_score },
                  { name: report.subject_2_name, score: report.subject_2_score },
                  { name: report.subject_3_name, score: report.subject_3_score },
                  { name: report.subject_4_name, score: report.subject_4_score },
                  { name: report.subject_5_name, score: report.subject_5_score },
                ].map((subject, idx) => (
                  <View key={idx} style={styles.scoreRow}>
                    <View style={THEME.rowBetween}>
                      <Text style={styles.subjectName}>{subject.name}</Text>
                      <Text style={[styles.subjectScore, { color: getScoreColor(Number(subject.score)) }]}>
                        {subject.score}%
                      </Text>
                    </View>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${subject.score}%`,
                            backgroundColor: getScoreColor(Number(subject.score)),
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>

              {/* Lab Attendance & Discipline Card */}
              <View style={styles.rowGrid}>
                <View style={[THEME.glassCard, styles.halfCard]}>
                  <Text style={styles.miniCardTitle}>Lab Attendance</Text>
                  <Text style={[styles.bigMetric, { color: getScoreColor(Number(report.lab_attendance)) }]}>
                    {report.lab_attendance}%
                  </Text>
                  <Text style={styles.cardDesc}>Scheduled Labs Attended</Text>
                </View>

                <View style={[THEME.glassCard, styles.halfCard]}>
                  <Text style={styles.miniCardTitle}>Discipline Rating</Text>
                  <Text style={[styles.bigMetric, { color: COLORS.secondary }]}>
                    {report.discipline}
                  </Text>
                  <Text style={styles.cardDesc}>Behavior Assessment</Text>
                </View>
              </View>

              {/* Teacher Remarks Card */}
              <View style={THEME.glassCard}>
                <Text style={THEME.cardTitle}>Class Teacher Remarks</Text>
                <Text style={styles.remarkText}>
                  "{report.class_teacher_remark || 'No specific remark recorded for this period.'}"
                </Text>
              </View>

              {/* Signatures Card */}
              <View style={THEME.glassCard}>
                <Text style={THEME.cardTitle}>Signatures Verification</Text>
                <View style={styles.signatureRow}>
                  <View style={styles.signatureBlock}>
                    <Text style={styles.sigTitle}>Class Teacher</Text>
                    {report.created_by?.signature_url ? (
                      <Image
                        source={{ uri: report.created_by.signature_url }}
                        style={styles.sigImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.sigPlaceholder}>
                        <Text style={styles.placeholderText}>Not Uploaded</Text>
                      </View>
                    )}
                    <Text style={styles.sigName}>({report.created_by?.name || 'Instructor'})</Text>
                  </View>

                  <View style={styles.signatureBlock}>
                    <Text style={styles.sigTitle}>Principal</Text>
                    {principalSig ? (
                      <Image
                        source={{ uri: principalSig }}
                        style={styles.sigImage}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.sigPlaceholder}>
                        <Text style={styles.placeholderText}>Not Uploaded</Text>
                      </View>
                    )}
                    <Text style={styles.sigName}>(Principal Settings)</Text>
                  </View>
                </View>
              </View>

              {/* Download/Share Report PDF */}
              <TouchableOpacity
                style={[THEME.btnPrimary, { marginBottom: 30 }]}
                onPress={handleExportPDF}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={THEME.btnPrimaryText}>Download Official PDF Report Card</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={[THEME.glassCard, styles.emptyCard]}>
              <Text style={styles.emptyText}>
                No report has been published for this period yet.
              </Text>
              <Text style={styles.emptySubText}>
                Reports are added by your class teacher at the end of each reporting period.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  welcomeText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  studentName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  studentMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  logoutBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  logoutBtnText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 12,
  },
  periodPickerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    backgroundColor: '#0F1221',
  },
  periodScroll: {
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  periodTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: COLORS.inputBg,
  },
  periodTabActive: {
    backgroundColor: COLORS.primary,
  },
  periodTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  periodTabTextActive: {
    color: '#FFFFFF',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 10,
    fontSize: 14,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  scoreRow: {
    marginBottom: 16,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  subjectScore: {
    fontSize: 15,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: COLORS.inputBg,
    borderRadius: 4,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  rowGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfCard: {
    width: (WINDOW_WIDTH - 50) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  miniCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  bigMetric: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  remarkText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontStyle: 'italic',
    lineHeight: 22,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  signatureBlock: {
    alignItems: 'center',
    width: '45%',
  },
  sigTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  sigImage: {
    width: 120,
    height: 60,
    backgroundColor: 'white',
    borderRadius: 6,
    padding: 4,
  },
  sigPlaceholder: {
    width: 120,
    height: 60,
    backgroundColor: COLORS.inputBg,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.textMuted,
  },
  placeholderText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  sigName: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 6,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
