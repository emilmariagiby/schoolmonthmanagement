/**
 * Helper utility to upload files directly to Cloudinary using unsigned presets.
 */
export const uploadToCloudinary = async (fileUri: string): Promise<string> => {
  const cloudName = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error(
      'Cloudinary configuration missing. Please specify EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET in your environment.'
    );
  }

  const formData = new FormData();
  
  // React Native FormData payload formatting for local files
  const fileData = {
    uri: fileUri,
    type: 'image/png',
    name: 'signature.png',
  };
  
  formData.append('file', fileData as any);
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const responseJson = await response.json();

  if (responseJson.error) {
    throw new Error(responseJson.error.message || 'Cloudinary upload failed.');
  }

  // Inject optimization parameters to returned URL:
  // - f_auto: choose best format on-the-fly (WebP, AVIF, etc.)
  // - q_auto: optimize quality compression
  // - w_300: scale width to 300px (ideal for card renders)
  const secureUrl = responseJson.secure_url as string;
  const optimizedUrl = secureUrl.replace('/upload/', '/upload/f_auto,q_auto,w_300/');
  
  return optimizedUrl;
};
