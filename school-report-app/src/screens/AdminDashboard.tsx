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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabaseClient';
import { COLORS, THEME } from '../theme';
import { parseStudentRoster, ParsedStudent, ImportError } from '../utils/ExcelImportHelper';

interface AdminDashboardProps {
  session: any;
  onLogout: () => void;
}

export default function AdminDashboard({ session, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'roster' | 'staff' | 'settings'>('roster');
  
  // Principal Signature Settings State
  const [principalSig, setPrincipalSig] = useState<string | null>(null);
  const [uploadingSig, setUploadingSig] = useState<boolean>(false);
  
  // Roster Upload State
  const [excelFile, setExcelFile] = useState<any>(null);
  const [parsedRoster, setParsedRoster] = useState<ParsedStudent[]>([]);
  const [rosterErrors, setRosterErrors] = useState<ImportError[]>([]);
  const [importing, setImporting] = useState<boolean>(false);
  const [importLogs, setImportLogs] = useState<string>('');

  // Roster Listing State
  const [approvedStudents, setApprovedStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);

  // Instructor Form State
  const [staffEmail, setStaffEmail] = useState<string>('');
  const [staffName, setStaffName] = useState<string>('');
  const [approvedInstructors, setApprovedInstructors] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState<boolean>(false);
  const [savingStaff, setSavingStaff] = useState<boolean>(false);

  useEffect(() => {
    fetchPrincipalSignature();
    if (activeTab === 'roster') fetchRoster();
    if (activeTab === 'staff') fetchStaff();
  }, [activeTab]);

  const fetchPrincipalSignature = async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('principal_signature_url')
        .eq('id', '00000000-0000-0000-0000-000000000000')
        .single();
      if (!error && data) {
        setPrincipalSig(data.principal_signature_url);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRoster = async () => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('approved_students')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setApprovedStudents(data || []);
    } catch (err: any) {
      console.error('Error fetching student roster:', err.message);
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchStaff = async () => {
    setLoadingStaff(true);
    try {
      const { data, error } = await supabase
        .from('approved_instructors')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setApprovedInstructors(data || []);
    } catch (err: any) {
      console.error('Error fetching staff roster:', err.message);
    } finally {
      setLoadingStaff(false);
    }
  };

  // 1. Roster Import Handler
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

      const { data, errors } = parseStudentRoster(arrayBuffer);
      setParsedRoster(data);
      setRosterErrors(errors);
    } catch (err) {
      Alert.alert('File Error', 'Could not parse selected Excel document.');
    }
  };

  const handleImportRoster = async () => {
    if (parsedRoster.length === 0) return;

    setImporting(true);
    setImportLogs('Initializing student roster bulk import...\n');

    try {
      // Format payload for approved_students table
      const payloads = parsedRoster.map((item) => ({
        mobile_no: item.mobile_no,
        name: item.name,
        class: item.class,
        section: item.section,
        parent_email: item.parent_email,
        created_at: new Date().toISOString(),
      }));

      // Insert/Upsert into Supabase
      const { error } = await supabase.from('approved_students').upsert(payloads, {
        onConflict: 'mobile_no',
      });

      if (error) throw error;

      setImportLogs(
        (prev) =>
          prev +
          `✅ Roster upload complete.\nSuccessfully registered/updated ${payloads.length} students on approved roster.\n`
      );
      Alert.alert('Import Success', `${payloads.length} students pre-approved successfully.`);
      setParsedRoster([]);
      setExcelFile(null);
      fetchRoster();
    } catch (err: any) {
      setImportLogs((prev) => prev + `❌ Error occurred: ${err.message}\n`);
      Alert.alert('Import Failed', err.message || 'An error occurred during upload.');
    } finally {
      setImporting(false);
    }
  };

  // 2. Instructor Onboarding Handler
  const handleAddStaff = async () => {
    const email = staffEmail.trim().toLowerCase();
    const name = staffName.trim();

    if (!email || !name) {
      Alert.alert('Validation Error', 'Please fill in both name and email.');
      return;
    }

    setSavingStaff(true);
    try {
      const { error } = await supabase.from('approved_instructors').upsert(
        { email, name, created_at: new Date().toISOString() },
        { onConflict: 'email' }
      );

      if (error) throw error;

      Alert.alert('Success', `Instructor ${name} pre-approved successfully.`);
      setStaffEmail('');
      setStaffName('');
      fetchStaff();
    } catch (err: any) {
      Alert.alert('Database Error', err.message || 'Could not add instructor.');
    } finally {
      setSavingStaff(false);
    }
  };

  const handleDeleteStaff = async (email: string) => {
    Alert.alert('Confirm Delete', `Remove approval for ${email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await supabase.from('approved_instructors').delete().eq('email', email);
            if (error) throw error;
            fetchStaff();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Could not delete instructor.');
          }
        },
      },
    ]);
  };

  // 3. Principal Signature Upload Handler
  const handleUploadPrincipalSig = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Camera roll access is required to upload images.');
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
      const fileName = `principal_signature.png`;

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

      // Save URL to System Settings
      const { error: dbErr } = await supabase
        .from('system_settings')
        .update({ principal_signature_url: publicUrl })
        .eq('id', '00000000-0000-0000-0000-000000000000');

      if (dbErr) throw dbErr;

      setPrincipalSig(publicUrl);
      Alert.alert('Success', 'Global Principal Signature updated successfully.');
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload signature.');
    } finally {
      setUploadingSig(false);
    }
  };

  return (
    <View style={THEME.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>System Console</Text>
          <Text style={styles.nameText}>Administrator</Text>
          <Text style={styles.subText}>Role: Root Administrator</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'roster' && styles.activeTab]}
          onPress={() => setActiveTab('roster')}
        >
          <Text style={[styles.tabText, activeTab === 'roster' && styles.activeTabText]}>
            Student Roster
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'staff' && styles.activeTab]}
          onPress={() => setActiveTab('staff')}
        >
          <Text style={[styles.tabText, activeTab === 'staff' && styles.activeTabText]}>
            Instructors (Staff)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={[styles.tabText, activeTab === 'settings' && styles.activeTabText]}>
            Global Settings
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* TAB 1: Approved Student Roster */}
        {activeTab === 'roster' && (
          <View>
            <View style={THEME.glassCard}>
              <Text style={THEME.cardTitle}>Student Roster Bulk Import</Text>
              <Text style={styles.description}>
                Pre-approve students by uploading an Excel sheet. Column Headers required: `Name`, `Class`, `Section`, `Mobile No`, `Parent Email`.
              </Text>

              <TouchableOpacity style={styles.filePickerBox} onPress={handleSelectExcel}>
                <Text style={styles.filePickerTitle}>
                  {excelFile ? 'Change Roster File' : 'Select Student Roster File'}
                </Text>
                <Text style={styles.filePickerSub}>
                  {excelFile ? `${excelFile.name} (${Math.round(excelFile.size / 1024)} KB)` : 'Supports .xlsx, .xls'}
                </Text>
              </TouchableOpacity>

              {parsedRoster.length > 0 && (
                <View style={styles.previewContainer}>
                  <Text style={styles.previewTitle}>Roster File Preview</Text>
                  <Text style={styles.previewText}>
                    Ready to upload **{parsedRoster.length}** student profiles.
                  </Text>

                  {rosterErrors.length > 0 && (
                    <View style={styles.errorsBox}>
                      <Text style={styles.errorsTitle}>Parsing Errors ({rosterErrors.length}):</Text>
                      {rosterErrors.slice(0, 5).map((err, idx) => (
                        <Text key={idx} style={styles.errorText}>
                          • Row {err.row}: {err.message}
                        </Text>
                      ))}
                      {rosterErrors.length > 5 && (
                        <Text style={styles.errorText}>...and {rosterErrors.length - 5} more.</Text>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    style={[THEME.btnPrimary, { marginTop: 15 }]}
                    onPress={handleImportRoster}
                    disabled={importing || rosterErrors.length > 0}
                  >
                    {importing ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={THEME.btnPrimaryText}>Pre-approve Students list</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {importLogs ? (
                <View style={styles.logsBox}>
                  <Text style={styles.logsTitle}>Roster logs:</Text>
                  <Text style={styles.logsText}>{importLogs}</Text>
                </View>
              ) : null}
            </View>

            {/* Approved Students List */}
            <Text style={styles.sectionHeader}>Approved Roster List</Text>
            {loadingStudents ? (
              <ActivityIndicator size="small" color={COLORS.secondary} style={{ marginVertical: 20 }} />
            ) : approvedStudents.length === 0 ? (
              <Text style={styles.emptyText}>Roster is empty. Import a roster sheet above.</Text>
            ) : (
              approvedStudents.map((st, idx) => (
                <View key={idx} style={[THEME.glassCard, { marginVertical: 6 }]}>
                  <Text style={styles.itemName}>{st.name}</Text>
                  <Text style={styles.itemMeta}>
                    Grade {st.class} - Sec {st.section} | Mobile: {st.mobile_no}
                  </Text>
                  <Text style={styles.itemSubMeta}>Parent Email: {st.parent_email}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 2: Staff Management */}
        {activeTab === 'staff' && (
          <View>
            <View style={THEME.glassCard}>
              <Text style={THEME.cardTitle}>Add Approved Instructor</Text>
              <Text style={styles.description}>
                Authorize an email address to register with the Class Teacher/Instructor role.
              </Text>

              <Text style={THEME.label}>Instructor Full Name</Text>
              <TextInput
                style={THEME.input}
                placeholder="John Doe"
                placeholderTextColor={COLORS.textMuted}
                value={staffName}
                onChangeText={setStaffName}
              />

              <Text style={THEME.label}>Authorized Email Address</Text>
              <TextInput
                style={THEME.input}
                placeholder="teacher@school.edu"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                value={staffEmail}
                onChangeText={setStaffEmail}
              />

              <TouchableOpacity style={THEME.btnPrimary} onPress={handleAddStaff} disabled={savingStaff}>
                {savingStaff ? <ActivityIndicator color="#FFFFFF" /> : <Text style={THEME.btnPrimaryText}>Pre-approve Staff</Text>}
              </TouchableOpacity>
            </View>

            {/* Staff List */}
            <Text style={styles.sectionHeader}>Approved Staff Members</Text>
            {loadingStaff ? (
              <ActivityIndicator size="small" color={COLORS.secondary} style={{ marginVertical: 20 }} />
            ) : approvedInstructors.length === 0 ? (
              <Text style={styles.emptyText}>No instructors approved yet.</Text>
            ) : (
              approvedInstructors.map((inst, idx) => (
                <View key={idx} style={[THEME.glassCard, styles.staffItem]}>
                  <View>
                    <Text style={styles.itemName}>{inst.name}</Text>
                    <Text style={styles.itemMeta}>Email: {inst.email}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDeleteStaff(inst.email)}
                  >
                    <Text style={styles.deleteBtnText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 3: Global Settings */}
        {activeTab === 'settings' && (
          <View style={THEME.glassCard}>
            <Text style={THEME.cardTitle}>Global Principal Signature Settings</Text>
            <Text style={styles.description}>
              Upload the school principal's signature image file (PNG/JPEG). This image will render globally in the Principal signature block at the bottom of every student report card.
            </Text>

            <View style={styles.sigPreviewBox}>
              <Text style={styles.previewLabel}>Current Registered Signature:</Text>
              {principalSig ? (
                <Image
                  source={{ uri: principalSig }}
                  style={styles.sigImagePreview}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.sigImagePlaceholder}>
                  <Text style={styles.placeholderText}>No Signature Configured</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={THEME.btnPrimary}
              onPress={handleUploadPrincipalSig}
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
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
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
    fontFamily: 'monospace',
    fontSize: 11,
    color: COLORS.success,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 10,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 20,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  itemMeta: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  itemSubMeta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  staffItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  deleteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  deleteBtnText: {
    color: COLORS.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  sigPreviewBox: {
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
});
