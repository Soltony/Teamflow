
'use server';

import { revalidatePath } from 'next/cache';
import prisma from '@/lib/db';
import axios from 'axios';

interface ChangePasswordPayload {
    phoneNumber: string;
    currentPassword?: string;
    newPassword?: string;
}

export async function updateUserProfile(userId: string, data: { firstName: string, lastName: string, email: string, phoneNumber: string }) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                firstName: data.firstName,
                lastName: data.lastName,
                name: `${data.firstName} ${data.lastName}`,
                email: data.email,
                phoneNumber: data.phoneNumber,
            },
        });
        revalidatePath('/profile');
        return { success: true };
    } catch (error) {
        console.error("Failed to update user profile:", error);
        return { success: false, error: "Failed to update profile. The email or phone number may already be in use." };
    }
}

export async function changePassword(data: ChangePasswordPayload, accessToken: string) {
    try {
        const authApiUrl = `${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL}/api/Auth/change-password`;
        
        const payload = {
            phoneNumber: data.phoneNumber,
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
