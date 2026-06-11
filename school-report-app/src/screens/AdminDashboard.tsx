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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '../lib/supabaseClient';
import { COLORS, THEME } from '../theme';
import { parseStudentRoster, ParsedStudent, ImportError } from '../utils/ExcelImportHelper';
import { uploadToCloudinary } from '../utils/CloudinaryHelper';

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
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(false);

  // Instructor Form State
  const [staffEmail, setStaffEmail] = useState<string>('');
  const [staffName, setStaffName] = useState<string>('');
  const [instructorsList, setInstructorsList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState<boolean>(false);
  const [savingStaff, setSavingStaff] = useState<boolean>(false);

  // Password Management State
  const [newPassword, setNewPassword] = useState<string>('');
  const [changingPassword, setChangingPassword] = useState<boolean>(false);

  // User Reset Password State
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState<string>('');
  const [resettingUserPw, setResettingUserPw] = useState<boolean>(false);

  useEffect(() => {
    fetchPrincipalSignature();
    if (activeTab === 'roster') fetchStudents();
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

  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('name', { ascending: true });
      if (error) throw error;
      setStudentsList(data || []);
    } catch (err: any) {
      console.error('Error fetching students:', err.message);
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchStaff = async () => {
    setLoadingStaff(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'instructor')
        .order('name', { ascending: true });
      if (error) throw error;
      setInstructorsList(data || []);
    } catch (err: any) {
      console.error('Error fetching staff roster:', err.message);
    } finally {
      setLoadingStaff(false);
    }
  };

  // 1. Roster Import Handler (Bulk Creates Auth Users)
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
    setImportLogs('Initializing student roster account generation...\n');

    let successCount = 0;
    let errorCount = 0;
    let logs = '';

    try {
      for (const item of parsedRoster) {
        // Call RPC function to create Auth account with password set to mobile number
        const { data: userId, error: rpcErr } = await supabase.rpc('create_auth_user', {
          p_email: `${item.mobile_no}@school.report`,
          p_password: String(item.mobile_no),
          p_metadata: {
            role: 'student',
            name: item.name,
            class: String(item.class),
            section: item.section,
            mobile_no: String(item.mobile_no),
            parent_email: item.parent_email,
          },
        });

        if (rpcErr) {
          // If user already exists in auth.users, just update their metadata
          if (rpcErr.message.includes('already exists') || rpcErr.message.includes('unique constraint')) {
            const { error: profileError } = await supabase
              .from('profiles')
              .update({
                name: item.name,
                class: String(item.class),
                section: item.section,
                parent_email: item.parent_email,
              })
              .eq('mobile_no', String(item.mobile_no));

            if (profileError) {
              logs += `Row ${item.rowNumber} (${item.name}): Failed to update profile metadata: ${profileError.message}\n`;
              errorCount++;
            } else {
              logs += `Row ${item.rowNumber} (${item.name}): Account already existed. Updated profile settings.\n`;
              successCount++;
            }
          } else {
            logs += `Row ${item.rowNumber} (${item.name}): Failed to create user: ${rpcErr.message}\n`;
            errorCount++;
          }
        } else {
          logs += `Row ${item.rowNumber} (${item.name}): User account created successfully. Default password: ${item.mobile_no}\n`;
          successCount++;
        }
      }

      setImportLogs(logs + `\n✅ Process complete. Success: ${successCount}, Errors: ${errorCount}\n`);
      Alert.alert('Import Finished', `Created/updated ${successCount} student accounts.`);
      setParsedRoster([]);
      setExcelFile(null);
      fetchStudents();
    } catch (err: any) {
      setImportLogs((prev) => prev + `❌ Fatal Error: ${err.message}\n`);
      Alert.alert('Import Failed', err.message || 'An error occurred.');
    } finally {
      setImporting(false);
    }
  };

  // 2. Instructor Onboarding Handler (Creates Auth User)
  const handleAddStaff = async () => {
    const email = staffEmail.trim().toLowerCase();
    const name = staffName.trim();

    if (!email || !name) {
      Alert.alert('Validation Error', 'Please fill in both name and email.');
      return;
    }

    setSavingStaff(true);
    try {
      const { data, error } = await supabase.rpc('create_auth_user', {
        p_email: email,
        p_password: 'teacher123', // default teacher password
        p_metadata: {
          role: 'instructor',
          name: name,
        },
      });

      if (error) {
        if (error.message.includes('already exists') || error.message.includes('unique constraint')) {
          Alert.alert('Exists', 'An instructor account with this email is already registered.');
        } else {
          throw error;
        }
      } else {
        Alert.alert('Success', `Instructor account created for ${name}.\nInitial password is: teacher123`);
        setStaffEmail('');
        setStaffName('');
        fetchStaff();
      }
    } catch (err: any) {
      Alert.alert('Database Error', err.message || 'Could not add instructor.');
    } finally {
      setSavingStaff(false);
    }
  };

  // 3. Admin Changing Own Password
  const handleChangeOwnPassword = async () => {
    if (newPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      Alert.alert('Success', 'Your password has been changed successfully.');
      setNewPassword('');
    } catch (err: any) {
      Alert.alert('Failed', err.message || 'Could not change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  // 4. Admin Resetting a User's Password
  const handleResetUserPassword = async () => {
    if (!resetUser || resetPasswordVal.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters.');
      return;
    }

    setResettingUserPw(true);
    try {
      const { data, error } = await supabase.rpc('reset_user_password', {
        p_user_id: resetUser.id,
        p_new_password: resetPasswordVal,
      });

      if (error) throw error;

      Alert.alert('Success', `Password reset successfully for ${resetUser.name}.`);
      setResetUser(null);
      setResetPasswordVal('');
    } catch (err: any) {
      Alert.alert('Reset Failed', err.message || 'Could not reset password.');
    } finally {
      setResettingUserPw(false);
    }
  };

  // 5. Principal Signature Upload Handler
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
      const publicUrl = await uploadToCloudinary(img.uri);

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
                Upload student Excel sheets. It will automatically create login user accounts with their registered Mobile Number as initial password.
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
                    Ready to generate **{parsedRoster.length}** student accounts.
                  </Text>

                  {rosterErrors.length > 0 && (
                    <View style={styles.errorsBox}>
                      <Text style={styles.errorsTitle}>Parsing Errors ({rosterErrors.length}):</Text>
                      {rosterErrors.slice(0, 5).map((err, idx) => (
                        <Text key={idx} style={styles.errorText}>
                          • Row {err.row}: {err.message}
                        </Text>
                      ))}
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
                      <Text style={THEME.btnPrimaryText}>Create Student Accounts</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {importLogs ? (
                <View style={styles.logsBox}>
                  <Text style={styles.logsTitle}>Roster logs:</Text>
                  <ScrollView style={{ maxHeight: 150 }}>
                    <Text style={styles.logsText}>{importLogs}</Text>
                  </ScrollView>
                </View>
              ) : null}
            </View>

            {/* Approved Students List */}
            <Text style={styles.sectionHeader}>Active Student Roster List</Text>
            {loadingStudents ? (
              <ActivityIndicator size="small" color={COLORS.secondary} style={{ marginVertical: 20 }} />
            ) : studentsList.length === 0 ? (
              <Text style={styles.emptyText}>Roster is empty. Import a roster sheet above.</Text>
            ) : (
              studentsList.map((st, idx) => (
                <View key={idx} style={[THEME.glassCard, { marginVertical: 6 }]}>
                  <View style={THEME.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{st.name}</Text>
                      <Text style={styles.itemMeta}>
                        Grade {st.class} - Sec {st.section} | Mobile: {st.mobile_no}
                      </Text>
                      <Text style={styles.itemSubMeta}>Parent Email: {st.parent_email}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.resetBtn}
                      onPress={() => setResetUser(st)}
                    >
                      <Text style={styles.resetBtnText}>Reset Pw</Text>
                    </TouchableOpacity>
                  </View>
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
                Creates an instructor account. Initial login password will be set to: `teacher123`
              </Text>

              <Text style={THEME.label}>Instructor Full Name</Text>
              <TextInput
                style={THEME.input}
                placeholder="John Doe"
                placeholderTextColor={COLORS.textMuted}
                value={staffName}
                onChangeText={setStaffName}
              />

              <Text style={THEME.label}>Instructor Email Address</Text>
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
                {savingStaff ? <ActivityIndicator color="#FFFFFF" /> : <Text style={THEME.btnPrimaryText}>Create Staff Account</Text>}
              </TouchableOpacity>
            </View>

            {/* Staff List */}
            <Text style={styles.sectionHeader}>Active Staff Members</Text>
            {loadingStaff ? (
              <ActivityIndicator size="small" color={COLORS.secondary} style={{ marginVertical: 20 }} />
            ) : instructorsList.length === 0 ? (
              <Text style={styles.emptyText}>No instructors registered yet.</Text>
            ) : (
              instructorsList.map((inst, idx) => (
                <View key={idx} style={[THEME.glassCard, styles.staffItem]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{inst.name}</Text>
                    <Text style={styles.itemMeta}>Role: Class Instructor</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.resetBtn}
                    onPress={() => setResetUser(inst)}
                  >
                    <Text style={styles.resetBtnText}>Reset Pw</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* TAB 3: Global Settings */}
        {activeTab === 'settings' && (
          <View>
            {/* Principal Signature Settings */}
            <View style={THEME.glassCard}>
              <Text style={THEME.cardTitle}>Global Principal Signature Settings</Text>
              <Text style={styles.description}>
                Upload the school principal's signature image file (PNG/JPEG) to Cloudinary. It will render at the bottom of every student report card.
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

            {/* Password Change Settings */}
            <View style={THEME.glassCard}>
              <Text style={THEME.cardTitle}>Change Admin Password</Text>
              <Text style={THEME.label}>New Admin Password</Text>
              <TextInput
                style={THEME.input}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
              />
              <TouchableOpacity
                style={THEME.btnPrimary}
                onPress={handleChangeOwnPassword}
                disabled={changingPassword}
              >
                {changingPassword ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={THEME.btnPrimaryText}>Change Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Reset password Modal */}
      <Modal visible={resetUser !== null} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={THEME.rowBetween}>
              <View>
                <Text style={styles.modalTitle}>Reset User Password</Text>
                <Text style={styles.modalSubtitle}>{resetUser?.name}</Text>
              </View>
              <TouchableOpacity onPress={() => setResetUser(null)}>
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 20 }}>
              <Text style={THEME.label}>Specify New Password</Text>
              <TextInput
                style={THEME.input}
                placeholder="Enter at least 6 characters"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                value={resetPasswordVal}
                onChangeText={setResetPasswordVal}
              />

              <TouchableOpacity
                style={THEME.btnPrimary}
                onPress={handleResetUserPassword}
                disabled={resettingUserPw}
              >
                {resettingUserPw ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={THEME.btnPrimaryText}>Override Password</Text>
                )}
              </TouchableOpacity>
            </View>
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
  resetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  resetBtnText: {
    color: COLORS.secondary,
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
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: COLORS.secondary,
    fontWeight: '600',
    marginTop: 2,
  },
  closeText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 14,
  },
});
