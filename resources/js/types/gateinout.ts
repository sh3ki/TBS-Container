/**
 * Gate In/Out Module - TypeScript Interfaces
 * 
 * This module handles the two-step container gate operations:
 * - Guards create Pre-In/Pre-Out records
 * - Checkers approve to create inventory (Gate-In) or complete inventory (Gate-Out)
 */

/**
 * Pre-In Record (Guards create, Checkers approve)
 * Represents a container waiting to be gated into the yard
 */
export interface PreInRecord {
    hashed_id: string;
    p_id: number;
    container_no: string;
    client_id: number;
    client_name: string;
    client_code: string;
    size_type: number;
    size: string;
    type: string;
    size_desc: string;
    cnt_class: 'E' | 'F'; // E = Empty, F = Full
    booking?: string;
    shipper?: string;
    slot?: string;
    plate_no?: string;
    hauler?: string;
    remarks?: string;
    date_added: string;
    created_by: string;
    user_id: number;
    full_name: string;
}

/**
 * Pre-Out Record (Guards create, Checkers approve)
 * Represents a container waiting to be gated out of the yard
 */
export interface PreOutRecord {
    hashed_id: string;
    p_id: number;
    container_no: string;
    client_id: number;
    client_name: string;
    client_code: string;
    size: string;
    type: string;
    vessel?: string;
    voyage?: string;
    plate_no?: string;
    hauler?: string;
    hauler_driver?: string;
    license_no?: string;
    seal_no?: string;
    remarks?: string;
    date_added: string;
    created_by: string;
    user_id: number;
    full_name: string;
    is_on_hold: boolean; // Containers on hold cannot be gated out
}

/**
 * Container currently in yard (for Pre-Out dropdown)
 */
export interface ContainerInYard {
    container_no: string;
    client_name: string;
    client_code: string;
    size: string;
    type: string;
}

/**
 * Client option for dropdowns
 */
export interface ClientOption {
    c_id: number;
    client_name: string;
    client_code: string;
}

/**
 * Size/Type combination option for dropdowns
 */
export interface SizeTypeOption {
    s_id: number;
    size: string;
    type: string;
    description: string;
}

/**
 * Form data for creating Pre-In record
 */
export interface PreInFormData {
    container_no: string;
    client_id: number | null;
    size_type: number | null;
    cnt_class: 'E' | 'F';
    booking?: string;
    shipper?: string;
    slot?: string;
    plate_no?: string;
    hauler?: string;
    remarks?: string;
}

/**
 * Form data for creating Pre-Out record
 */
export interface PreOutFormData {
    container_no: string;
    vessel?: string;
    voyage?: string;
    plate_no?: string;
    hauler?: string;
    hauler_driver?: string;
    license_no?: string;
    seal_no?: string;
    remarks?: string;
}

/**
 * Validation errors
 */
export interface ValidationErrors {
    container_no?: string[];
    client_id?: string[];
    size_type?: string[];
    cnt_class?: string[];
    vessel?: string[];
    voyage?: string[];
    plate_no?: string[];
    [key: string]: string[] | undefined;
}

/**
 * API Response structure
 */
export interface GateinoutApiResponse<T = unknown> {
    success: boolean;
    message?: string;
    warning?: string; // For banned containers or hold warnings
    data?: T;
    total?: number;
    errors?: ValidationErrors;
}

/**
 * List request parameters
 */
export interface ListRequestParams {
    start?: number;
    length?: number;
    search?: string;
}
