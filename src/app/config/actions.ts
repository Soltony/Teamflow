'use server';

import prisma from '@/lib/db';
import { revalidatePath } from 'next/cache';
import axios, { AxiosError } from 'axios';
import { jwtDecode } from 'jwt-decode';

interface AuthResponse {
  isSuccess: boolean;
  accessToken?: string;
  refreshToken?: string;
  errors?: string[] | string | null;
}

interface AuthenticatedUser {
  nameid: string;
  email: string;
  given_name: string;
  family_name: string;
  picture?: string;
  [key: string]: any;
}


export async function assignRolesToUser(userId: string, roleIds: string[]) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                roles: {
                    set: roleIds.map(id => ({ id })),
                }
            }
        });
        revalidatePath('/config');
        return { success: true };
    } catch (error) {
        console.error("Failed to assign roles to user:", error);
        return { success: false, error: 'Failed to assign roles.' };
    }
}

export async function createUser(data: { firstName: string, lastName: string, email?: string | null, phoneNumber: string, password?: string, roleIds: string[] }, accessToken: string) {
    if (!data.password) {
        return { success: false, error: "Password is required." };
    }
    if (!accessToken) {
        return { success: false, error: "Authentication token is missing. You may need to log in again." };
    }

    try {
        const authApiUrl = `${process.env.NEXT_PUBLIC_AUTH_API_BASE_URL}/api/Auth/register`;

        const registrationPayload = {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email || null,
            phoneNumber: data.phoneNumber,
            password: data.password,
        };

        const registrationResponse = await axios.post<AuthResponse>(authApiUrl, registrationPayload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        if (!registrationResponse.data.isSuccess || !registrationResponse.data.accessToken) {
            const errorValue = registrationResponse.data.errors;
            const errorMessage = Array.isArray(errorValue) ? errorValue.join(', ') : (typeof errorValue === 'string' ? errorValue : 'Failed to register user with the authentication service.');
            return { success: false, error: errorMessage };
        }

        const decodedToken = jwtDecode<AuthenticatedUser>(registrationResponse.data.accessToken);
        const userIdFromIdp = decodedToken.nameid;

        const existingUser = await prisma.user.findUnique({
            where: { id: userIdFromIdp }
        });

        if (existingUser) {
            console.warn(`User with ID ${userIdFromIdp} already exists in local DB but was just registered.`);
             await prisma.user.update({
                where: { id: userIdFromIdp },
                data: {
                    roles: {
                        set: data.roleIds.map(id => ({ id }))
                    }
                }
            });
        } else {
             await prisma.user.create({
                data: {
                    id: userIdFromIdp,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    name: `${data.firstName} ${data.lastName}`,
                    email: data.email || null,
                    phoneNumber: data.phoneNumber,
                    roles: {
                        connect: data.roleIds.map(id => ({ id }))
                    }
                }
            });
        }
       
        revalidatePath('/config');
        return { success: true };

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("Auth service registration failed. Response:", error.response?.status, error.response?.data);
            if (error.response) {
                if (error.response.status === 401) {
                    return { success: false, error: "Authentication failed. Your session may have expired. Please log in again." };
                }
                const responseData = error.response.data as any;
                const errorValue = responseData.errors;

                let errorMessage = 'An unexpected error occurred during registration with the auth service.';
                if (Array.isArray(errorValue)) {
                    errorMessage = errorValue.join(', ');
                } else if (typeof errorValue === 'string') {
                    errorMessage = errorValue;
                }
                
                return { success: false, error: errorMessage };
            }
        }
        console.error("Failed to create user:", error);
        return { success: false, error: 'An unexpected server error occurred. Could not connect to the authentication service.' };
    }
}

export async function deleteUser(userId: string) {
    try {
        await prisma.user.delete({
            where: { id: userId },
        });
        revalidatePath('/config');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete user:", error);
        return { success: false, error: "Failed to delete user. They may be associated with projects, tasks, or teams. Please reassign their responsibilities before deleting." };
    }
}


export async function createRole(data: { name: string, description?: string, permissions?: string[] }) {
    try {
        await prisma.role.create({
            data: {
                name: data.name,
                description: data.description,
                permissions: data.permissions
            }
        });
        revalidatePath('/config');
        return { success: true };
    } catch (error) {
        console.error("Failed to create role:", error);
        return { success: false, error: 'A role with this name may already exist.' };
    }
}

export async function updateRole(id: string, data: { name: string, description?: string, permissions?: string[] }) {
    try {
        await prisma.role.update({
            where: { id },
            data
        });
        revalidatePath('/config');
        return { success: true };
    } catch (error) {
        console.error("Failed to update role:", error);
        return { success: false, error: 'Failed to update role.' };
    }
}

export async function deleteRole(id: string) {
    try {
        const usersWithRole = await prisma.user.count({
            where: { roles: { some: { id } } }
        });
        if (usersWithRole > 0) {
            return { success: false, error: 'Cannot delete role as it is currently assigned to one or more users.' };
        }
        await prisma.role.delete({ where: { id } });
        revalidatePath('/config');
        return { success: true };
    } catch (error) {
        console.error("Failed to delete role:", error);
        return { success: false, error: 'Failed to delete role.' };
    }
}
