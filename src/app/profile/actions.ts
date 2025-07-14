
'use server';

import axios from 'axios';

interface ChangePasswordPayload {
    phoneNumber: string;
    currentPassword?: string;
    newPassword?: string;
}

export async function changePassword(data: ChangePasswordPayload, accessToken: string) {
    try {
        const authApiUrl = `${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL}/api/Auth/change-password`;
        const response = await axios.post(authApiUrl, data, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        
        // Check for a success message as per the updated API contract
        if (response.data?.message === "Password changed successfully.") {
            return { success: true };
        } else {
            // Handle cases where the server responds but doesn't confirm success
            const errorMessage = Array.isArray(response.data.errors) ? response.data.errors.join(', ') : 'An unknown error occurred.';
            return { success: false, error: errorMessage };
        }
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            console.error("Auth service password change failed. Response:", error.response.status, error.response.data);
             const responseData = error.response.data as any;
             const errorValue = responseData.errors;
             let errorMessage = 'An unexpected error occurred during password change.';
             if (Array.isArray(errorValue)) {
                 errorMessage = errorValue.join(', ');
             } else if (typeof errorValue === 'string') {
                 errorMessage = errorValue;
             }
            return { success: false, error: errorMessage };
        }
        console.error("Failed to change password:", error);
        return { success: false, error: 'Could not connect to the authentication service.' };
    }
}
