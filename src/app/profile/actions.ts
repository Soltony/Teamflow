
'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';
import axios from 'axios';

interface ChangePasswordPayload {
    phoneNumber: string;
    currentPassword?: string;
    newPassword?: string;
}

const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return '';
    // If it starts with '0', replace with +251. Otherwise, assume it's already formatted.
    if (phone.startsWith('0')) {
        return `+251${phone.substring(1)}`;
    }
    return phone;
};


export async function updateUserProfile(userId: string, data: { email: string, phoneNumber: string }, accessToken: string) {
    try {
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (!currentUser) {
            return { success: false, error: "User not found." };
        }

        const emailChanged = data.email !== currentUser.email;
        const phoneChanged = data.phoneNumber !== currentUser.phoneNumber;

        if (phoneChanged) {
            const changePhoneUrl = `${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL}/api/Auth/change-phone-number`;
            
            const payload = { 
                currentPhoneNumber: formatPhoneNumber(currentUser.phoneNumber), 
                newPhoneNumber: formatPhoneNumber(data.phoneNumber) 
            };

            await axios.post(changePhoneUrl, payload, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
        }

        if (emailChanged && !phoneChanged) { // Only update email if phone didn't change, as phone change implies profile update
             const updateProfileUrl = `${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL}/api/Auth/update-profile`;
             await axios.put(updateProfileUrl, { email: data.email, phoneNumber: formatPhoneNumber(data.phoneNumber) }, {
                 headers: {
                     'Authorization': `Bearer ${accessToken}`,
                     'Content-Type': 'application/json'
                 },
             });
        }

        // Update local database regardless
        await prisma.user.update({
            where: { id: userId },
            data: {
                email: data.email,
                phoneNumber: data.phoneNumber,
            },
        });
        
        revalidatePath('/profile');
        return { success: true };
    } catch (error) {
        if (axios.isAxiosError(error) && error.response) {
            console.error("Auth service profile update failed. Response:", error.response.status, error.response.data);
            const responseData = error.response.data as any;
            const errorValue = responseData.errors || responseData.message;
            let errorMessage = 'An unexpected error occurred during the profile update.';
            if (Array.isArray(errorValue)) {
                errorMessage = errorValue.join(', ');
            } else if (typeof errorValue === 'string') {
                errorMessage = errorValue;
            }
            return { success: false, error: errorMessage };
        }
        console.error("Failed to update user profile:", error);
        return { success: false, error: "Failed to update profile. The email or phone number may already be in use." };
    }
}


export async function changePassword(data: ChangePasswordPayload, accessToken: string) {
    try {
        const authApiUrl = `${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL}/api/Auth/change-password`;
        
        const payload = {
            phoneNumber: formatPhoneNumber(data.phoneNumber),
            currentPassword: data.currentPassword,
            newPassword: data.newPassword,
        };

        const response = await axios.post(authApiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        
        if (response.data?.isSuccess || response.status === 200 || response.status === 204) {
            return { success: true };
        } else {
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
