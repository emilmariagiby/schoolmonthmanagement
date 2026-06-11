import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabaseClient';
import { COLORS, THEME, WINDOW_WIDTH } from '../theme';
import { parsePerformanceReports, ParsedReport, ImportError } from '../utils/ExcelImportHelper';

interface InstructorDashboardProps {
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

export default function InstructorDashboard({ session, onLogout }: InstructorDashboardProps) {
  const [activeTab, setActiveTab] = useState<'students' | 'excel' | 'signature'>('students');
  const [instructorProfile, setInstructorProfile] = useState<any>(null);
  
  // Student & Reporting State
  const [students, setStudents] = useState<any[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('MAY_TO_JUNE');
  const [loading, setLoading] = useState<boolean>(true);
  
  // Manual Entry Form State
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [manualForm, setManualForm] = useState({
    subject_1_name: 'English',
    subject_1_score: '',
    subject_2_name: 'Mathematics',
    subject_2_score: '',
    subject_3_name: 'Physics',
    subject_3_score: '',
    subject_4_name: 'Chemistry',
    subject_4_score: '',
    subject_5_name: 'Computer Science',
    subject_5_score: '',
    lab_attendance: '',
    discipline: 'Excellent',
    class_teacher_remark: '',
  });

  // Excel Import State
  const [excelFile, setExcelFile] = useState<any>(null);
  const [parsedData, setParsedData] = useState<ParsedReport[]>([]);
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [importing, setImporting] = useState<boolean>(false);
  const [importLogs, setImportLogs] = useState<string>('');

  // Signature Upload State
  const [uploadingSig, setUploadingSig] = useState<boolean>(false);

  useEffect(() => {
    fetchInstructorData();
    fetchStudents();
  }, []);

  const fetchInstructorData = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      if (error) throw error;
      setInstructorProfile(data);
    } catch (err: any) {
      console.error('Error fetching instructor profile:', err.message);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('name', { ascending: true });
      if (error) throw error;
      setStudents(data);
    } catch (err: any) {
      console.error('Error fetching students:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // 1. Manual Entry Edit Handler
  const openManualEntry = async (student: any) => {
    setEditingStudent(student);
    setLoading(true);
    try {
      // Check if student has a report already for the selected period
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('student_id', student.id)
        .eq('period', selectedPeriod)
        .maybeSingle();

      if (!error && data) {
        setManualForm({
          subject_1_name: data.subject_1_name,
          subject_1_score: String(data.subject_1_score),
          subject_2_name: data.subject_2_name,
          subject_2_score: String(data.subject_2_score),
          subject_3_name: data.subject_3_name,
          subject_3_score: String(data.subject_3_score),
          subject_4_name: data.subject_4_name,
          subject_4_score: String(data.subject_4_score),
          subject_5_name: data.subject_5_name,
          subject_5_score: String(data.subject_5_score),
          lab_attendance: String(data.lab_attendance),
          discipline: data.discipline || 'Excellent',
          class_teacher_remark: data.class_teacher_remark || '',
        });
      } else {
        // Reset to default settings
        setManualForm({
          subject_1_name: 'English',
          subject_1_score: '',
          subject_2_name: 'Mathematics',
          subject_2_score: '',
          subject_3_name: 'Physics',
          subject_3_score: '',
          subject_4_name: 'Chemistry',
          subject_4_score: '',
          subject_5_name: 'Computer Science',
          subject_5_score: '',
          lab_attendance: '',
          discipline: 'Excellent',
          class_teacher_remark: '',
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveManualReport = async () => {
    if (!editingStudent) return;

    // Validate inputs
    const formVals = {
      s1: parseFloat(manualForm.subject_1_score),
      s2: parseFloat(manualForm.subject_2_score),
      s3: parseFloat(manualForm.subject_3_score),
      s4: parseFloat(manualForm.subject_4_score),
      s5: parseFloat(manualForm.subject_5_score),
      attendance: parseFloat(manualForm.lab_attendance),
    };

    const hasInvalidScores = Object.values(formVals).some(
      (val) => isNaN(val) || val < 0 || val > 100
    );

    if (hasInvalidScores) {
      Alert.alert('Invalid Input', 'All scores and lab attendance must be numbers between 0 and 100.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        student_id: editingStudent.id,
        period: selectedPeriod,
        subject_1_name: manualForm.subject_1_name,
        subject_1_score: formVals.s1,
        subject_2_name: manualForm.subject_2_name,
        subject_2_score: formVals.s2,
        subject_3_name: manualForm.subject_3_name,
        subject_3_score: formVals.s3,
        subject_4_name: manualForm.subject_4_name,
        subject_4_score: formVals.s4,
        subject_5_name: manualForm.subject_5_name,
        subject_5_score: formVals.s5,
        lab_attendance: formVals.attendance,
        discipline: manualForm.discipline,
        class_teacher_remark: manualForm.class_teacher_remark,
        created_by: session.user.id,
        updated_at: new Date().toISOString(),
      };

      // Perform Upsert in database
      const { error } = await supabase.from('reports').upsert(payload, {
        onConflict: 'student_id,period',
      });

      if (error) throw error;

      Alert.alert('Success', `Monthly report saved successfully for ${editingStudent.name}.`);
      setEditingStudent(null);
    } catch (err: any) {
      Alert.alert('Database Error', err.message || 'Could not save report.');
    } finally {
      setLoading(false);
    }
  };

  // 2. Signature Image Upload Handler
  const handleUploadSignature = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Camera roll access is required to upload your signature image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingSig(true);
    try {
      const img = result.assets[0];
      const fileName = `signature_${session.user.id}.png`;

      // Read image URI as Blob
      const response = await fetch(img.uri);
      const blob = await response.blob();

      // Upload file to Supabase signatures storage
      const { data, error: uploadErr } = await supabase.storage
        .from('signatures')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadErr) throw uploadErr;

      // Generate public image URL
      const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      // Save URL to profile
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ signature_url: publicUrl })
        .eq('id', session.user.id);

      if (dbErr) throw dbErr;

      // Update UI state
      setInstructorProfile((prev: any) => ({ ...prev, signature_url: publicUrl }));
      Alert.alert('Success', 'Signature image uploaded and saved successfully.');
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload signature.');
    } finally {
      setUploadingSig(false);
    }
  };

  // 3. Excel Bulk Import Handler
  const handleSelectExcel = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets[0]) return;

      const file = res.assets[0];
      setExcelFile(file);

      // Fetch arraybuffer of file
      const response = await fetch(file.uri);
      const arrayBuffer = await response.arrayBuffer();

      const { data, errors } = parsePerformanceReports(arrayBuffer);
      setParsedData(data);
      setImportErrors(errors);
    } catch (err: any) {
      Alert.alert('File Error', 'Could not parse selected Excel document.');
    }
  };

  const handleBulkInsertExcel = async () => {
    if (parsedData.length === 0) return;

    setImporting(true);
    setImportLogs('Initializing bulk report import...\n');

    try {
      // We need to fetch student profiles to match mobile numbers to user IDs
      const { data: studentsList, error: stErr } = await supabase
        .from('profiles')
        .select('id, name, mobile_no')
        .eq('role', 'student');

      if (stErr) throw stErr;

      const mobileMap = new Map(studentsList.map((s) => [s.mobile_no, s]));

      let successCount = 0;
      let errorCount = 0;
      let logs = '';

      // Prepare report payloads
      const payloads: any[] = [];

      for (const row of parsedData) {
        const student = mobileMap.get(row.mobile_no);
        if (!student) {
          logs += `Row ${row.rowNumber}: Ignored. Mobile ${row.mobile_no} is not registered in profiles table.\n`;
          errorCount++;
          continue;
        }

        payloads.push({
          student_id: student.id,
          period: selectedPeriod,
          subject_1_name: manualForm.subject_1_name,
          subject_1_score: row.subject_1_score,
          subject_2_name: manualForm.subject_2_name,
          subject_2_score: row.subject_2_score,
          subject_3_name: manualForm.subject_3_name,
          subject_3_score: row.subject_3_score,
          subject_4_name: manualForm.subject_4_name,
          subject_4_score: row.subject_4_score,
          subject_5_name: manualForm.subject_5_name,
          subject_5_score: row.subject_5_score,
          lab_attendance: row.lab_attendance,
          discipline: row.discipline,
          class_teacher_remark: row.class_teacher_remark,
          created_by: session.user.id,
          updated_at: new Date().toISOString(),
        });
      }

      if (payloads.length > 0) {
        // Insert in bulk to Supabase
        const { error: insertErr } = await supabase.from('reports').upsert(payloads, {
          onConflict: 'student_id,period',
        });

        if (insertErr) throw insertErr;
        successCount = payloads.length;
      }

      logs += `\nImport Finished:\n✅ Successfully uploaded ${successCount} report cards.\n❌ Failed / skipped ${errorCount} records.\n`;
      setImportLogs(logs);

      if (successCount > 0) {
        Alert.alert('Import Success', `${successCount} performance report cards uploaded successfully.`);
        setParsedData([]);
        setExcelFile(null);
      }
    } catch (err: any) {
      setImportLogs((prev) => prev + `Error occurred: ${err.message}\n`);
      Alert.alert('Import Failed', err.message || 'An error occurred during import.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={THEME.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Staff Portal</Text>
          <Text style={styles.nameText}>{instructorProfile?.name || 'Instructor'}</Text>
          <Text style={styles.subText}>Role: Instructor | Class Teacher</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'students' && styles.activeTab]}
          onPress={() => setActiveTab('students')}
        >
          <Text style={[styles.tabText, activeTab === 'students' && styles.activeTabText]}>
            Student List
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'excel' && styles.activeTab]}
          onPress={() => setActiveTab('excel')}
        >
          <Text style={[styles.tabText, activeTab === 'excel' && styles.activeTabText]}>
            Excel Import
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'signature' && styles.activeTab]}
          onPress={() => setActiveTab('signature')}
        >
          <Text style={[styles.tabText, activeTab === 'signature' && styles.activeTabText]}>
            My Signature
          </Text>
        </TouchableOpacity>
      </View>

      {/* Select Period Dropdown Banner */}
      {activeTab !== 'signature' && (
        <View style={styles.periodPickerBanner}>
          <Text style={styles.periodPickerLabel}>Active Reporting Period:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {PERIODS.map((period) => (
              <TouchableOpacity
                key={period.key}
                style={[
                  styles.periodBubble,
                  selectedPeriod === period.key && styles.periodBubbleActive,
                ]}
                onPress={() => setSelectedPeriod(period.key)}
              >
                <Text
                  style={[
                    styles.periodBubbleText,
                    selectedPeriod === period.key && styles.periodBubbleTextActive,
                  ]}
                >
                  {period.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {loading && activeTab === 'students' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
          <Text style={styles.loadingText}>Fetching student details...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container}>
          {/* TAB 1: Student Manual Entry List */}
          {activeTab === 'students' && (
            <View>
              <Text style={THEME.cardTitle}>Manual Performance Feeder</Text>
              <Text style={styles.description}>
                Select a student below to manually enter or update their scores, lab attendance, and remarks.
              </Text>

              {students.length === 0 ? (
                <View style={THEME.glassCard}>
                  <Text style={styles.emptyText}>No registered students found.</Text>
                  <Text style={styles.emptySubText}>
                    Please have an Admin seed the student profiles roster first.
                  </Text>
                </View>
              ) : (
                students.map((student) => (
                  <TouchableOpacity
                    key={student.id}
                    style={THEME.glassCard}
                    onPress={() => openManualEntry(student)}
                  >
                    <View style={THEME.rowBetween}>
                      <View>
                        <Text style={styles.studentName}>{student.name}</Text>
                        <Text style={styles.studentMeta}>
                          Grade {student.class} - Sec {student.section} | Mobile: {student.mobile_no}
                        </Text>
                      </View>
                      <View style={styles.actionBadge}>
                        <Text style={styles.actionBadgeText}>Edit Report</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* TAB 2: Excel Import Feeder */}
          {activeTab === 'excel' && (
            <View style={THEME.glassCard}>
              <Text style={THEME.cardTitle}>Excel Report Bulk Upload</Text>
              <Text style={styles.description}>
                Upload an Excel spreadsheet containing report cards for this period. Students will be mapped by Mobile Number.
              </Text>

              <TouchableOpacity style={styles.filePickerBox} onPress={handleSelectExcel}>
                <Text style={styles.filePickerTitle}>
                  {excelFile ? 'Change Selected File' : 'Select Spreadsheet'}
                </Text>
                <Text style={styles.filePickerSub}>
                  {excelFile ? `${excelFile.name} (${Math.round(excelFile.size / 1024)} KB)` : 'Supports .xlsx, .xls'}
                </Text>
              </TouchableOpacity>

              {/* Subject Config Headers */}
              <View style={styles.subjectConfigCard}>
                <Text style={styles.miniHeader}>Subject Schema Names</Text>
                <Text style={styles.miniSub}>Configure dynamic names for the 5 subjects before bulk upload:</Text>
                {[1, 2, 3, 4, 5].map((idx) => (
                  <View key={idx} style={styles.subjectConfigRow}>
                    <Text style={styles.subjectConfigLabel}>Subject {idx}:</Text>
                    <TextInput
                      style={[THEME.input, { flex: 1, marginBottom: 8 }]}
                      value={(manualForm as any)[`subject_${idx}_name`]}
                      onChangeText={(val) =>
                        setManualForm((prev) => ({ ...prev, [`subject_${idx}_name`]: val }))
                      }
                    />
                  </View>
                ))}
              </View>

              {parsedData.length > 0 && (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewTitle}>Excel File Preview</Text>
                  <Text style={styles.previewText}>
                    Detected **{parsedData.length}** records ready to import.
                  </Text>

                  {importErrors.length > 0 && (
                    <View style={styles.errorsBox}>
                      <Text style={styles.errorsTitle}>Formatting Errors ({importErrors.length}):</Text>
                      {importErrors.slice(0, 5).map((err, idx) => (
                        <Text key={idx} style={styles.errorText}>
                          • Row {err.row}: {err.message}
                        </Text>
                      ))}
                      {importErrors.length > 5 && (
                        <Text style={styles.errorText}>...and {importErrors.length - 5} more.</Text>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    style={[THEME.btnPrimary, { marginTop: 15 }]}
                    onPress={handleBulkInsertExcel}
                    disabled={importing || importErrors.length > 0}
                  >
                    {importing ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={THEME.btnPrimaryText}>Feed Data into Database</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {importLogs ? (
                <View style={styles.logsBox}>
                  <Text style={styles.logsTitle}>Import Logs:</Text>
                  <ScrollView style={{ maxHeight: 150 }}>
                    <Text style={styles.logsText}>{importLogs}</Text>
                  </ScrollView>
                </View>
              ) : null}
            </View>
          )}

          {/* TAB 3: Signature Image Upload */}
          {activeTab === 'signature' && (
            <View style={THEME.glassCard}>
              <Text style={THEME.cardTitle}>Class Teacher Signature Manager</Text>
              <Text style={styles.description}>
                Upload an image of your signature (PNG or JPEG format). This signature will be attached automatically to the bottom of all student report cards that you fill out.
              </Text>

              <View style={styles.signaturePreviewBox}>
                <Text style={styles.previewLabel}>Current Registered Signature:</Text>
                {instructorProfile?.signature_url ? (
                  <Image
                    source={{ uri: instructorProfile.signature_url }}
                    style={styles.sigImagePreview}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.sigImagePlaceholder}>
                    <Text style={styles.placeholderText}>No Signature Uploaded Yet</Text>
                  </View>
                )}
              </View>

              <TouchableOpacity
                style={THEME.btnPrimary}
                onPress={handleUploadSignature}
                disabled={uploadingSig}
              >
                {uploadingSig ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={THEME.btnPrimaryText}>Upload Signature Image</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* Manual Entry modal */}
      <Modal visible={editingStudent !== null} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={THEME.rowBetween}>
              <View>
                <Text style={styles.modalTitle}>Feed Student Marks</Text>
                <Text style={styles.modalSubtitle}>{editingStudent?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingStudent(null)}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalSectionTitle}>Subject Scores</Text>
              
              {[1, 2, 3, 4, 5].map((idx) => {
                const subNameKey = `subject_${idx}_name`;
                const subScoreKey = `subject_${idx}_score`;
                return (
                  <View key={idx} style={styles.modalInputRow}>
                    <TextInput
                      style={[THEME.input, { flex: 1.5, marginRight: 10 }]}
                      placeholder="Subject Name"
                      placeholderTextColor={COLORS.textMuted}
                      value={(manualForm as any)[subNameKey]}
                      onChangeText={(val) =>
                        setManualForm((prev) => ({ ...prev, [subNameKey]: val }))
                      }
                    />
                    <TextInput
                      style={[THEME.input, { flex: 1 }]}
                      placeholder="Mark %"
                      placeholderTextColor={COLORS.textMuted}
                      keyboardType="numeric"
                      value={(manualForm as any)[subScoreKey]}
                      onChangeText={(val) =>
                        setManualForm((prev) => ({ ...prev, [subScoreKey]: val }))
                      }
                    />
                  </View>
                );
              })}

              <Text style={styles.modalSectionTitle}>Attendance & Behavior</Text>
              <Text style={THEME.label}>Lab Attendance (%)</Text>
              <TextInput
                style={THEME.input}
                placeholder="e.g. 85"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="numeric"
                value={manualForm.lab_attendance}
                onChangeText={(val) => setManualForm((prev) => ({ ...prev, lab_attendance: val }))}
              />

              <Text style={THEME.label}>Discipline Rating</Text>
              <TextInput
                style={THEME.input}
                placeholder="e.g. Excellent / Good / Satisfactory"
                placeholderTextColor={COLORS.textMuted}
                value={manualForm.discipline}
                onChangeText={(val) => setManualForm((prev) => ({ ...prev, discipline: val }))}
              />

              <Text style={THEME.label}>Class Teacher Remarks</Text>
              <TextInput
                style={[THEME.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Write student feedback here..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
                value={manualForm.class_teacher_remark}
                onChangeText={(val) =>
                  setManualForm((prev) => ({ ...prev, class_teacher_remark: val }))
                }
              />

              <TouchableOpacity style={THEME.btnPrimary} onPress={handleSaveManualReport}>
                <Text style={THEME.btnPrimaryText}>Save Performance Report</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  nameText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subText: {
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0F1221',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  activeTabText: {
    color: COLORS.primaryGlow,
  },
  periodPickerBanner: {
    backgroundColor: '#1E243A',
    paddingVertical: 8,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  periodPickerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    marginRight: 10,
  },
  periodBubble: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.inputBg,
    marginRight: 8,
  },
  periodBubbleActive: {
    backgroundColor: COLORS.primary,
  },
  periodBubbleText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  periodBubbleTextActive: {
    color: '#FFFFFF',
  },
  container: {
    padding: 20,
    paddingBottom: 40,
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
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  studentMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  actionBadge: {
    backgroundColor: 'rgba(138, 92, 255, 0.15)',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  actionBadgeText: {
    color: COLORS.primaryGlow,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  filePickerBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.inputBg,
    borderRadius: 16,
    paddingVertical: 35,
    alignItems: 'center',
    marginBottom: 20,
  },
  filePickerTitle: {
    color: COLORS.secondary,
    fontWeight: '700',
    fontSize: 15,
  },
  filePickerSub: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  subjectConfigCard: {
    backgroundColor: '#0F1221',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  miniHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  miniSub: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  subjectConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subjectConfigLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    width: 80,
  },
  previewContainer: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.cardBorder,
    paddingTop: 15,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  previewText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  errorsBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  errorsTitle: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
  },
  logsBox: {
    backgroundColor: '#07080e',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  logsTitle: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 6,
  },
  logsText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 11,
    color: COLORS.success,
  },
  signaturePreviewBox: {
    alignItems: 'center',
    marginVertical: 24,
  },
  previewLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  sigImagePreview: {
    width: 250,
    height: 120,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 10,
  },
  sigImagePlaceholder: {
    width: 250,
    height: 120,
    backgroundColor: COLORS.inputBg,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.textMuted,
  },
  placeholderText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  closeText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 14,
  },
  modalScroll: {
    paddingVertical: 16,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 10,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalInputRow: {
    flexDirection: 'row',
  },
});
