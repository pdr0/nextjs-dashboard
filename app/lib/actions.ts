'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { z } from 'zod'
import { sql } from '@vercel/postgres';

const InvoiceFormScheme = z.object({
    id: z.string({
        invalid_type_error: 'Please select a customer.',
    }),
    customerId: z.string(),
    amount: z.coerce.number()
        .gt(0, { message: 'Please enter an amount greater than $0.' }),
    status: z.enum(['pending', 'paid'], {
        invalid_type_error: 'Please select an invoice status.',
    }),
    date: z.string(),
})

// CREATE INVOICE
const CreateInvoice = InvoiceFormScheme.omit({ id: true, date: true });

// This is temporary until @types/react-dom is updated
export type State = {
    errors?: {
        customerId?: string[];
        amount?: string[];
        status?: string[];
    };
    message?: string | null;
};

export async function createInvoice(prevState: State, formData: FormData) {
    const rawFormData = Object.fromEntries(formData.entries());
    const validatedFields = CreateInvoice.safeParse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    })
    const { customerId, amount, status } = CreateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    try {
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
        console.log(`[createInvoice] -  invoice inserted`)
        console.table(rawFormData);
    } catch (e) {
        return {
            message: 'Database Error: Failed to Create Invoice.',
        };
    }

    console.log(`[createInvoice] -  invoice inserted`)
    console.table(rawFormData);

    // Revalidate cache at side client and redirect.
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices')
    return formData;
}

const UpdateInvoice = InvoiceFormScheme.omit({ id: true, date: true });

// UPDATE INVOICE
export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amountInCents = amount * 100;

    try {
        await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
        `;
    } catch (e) {
        return {
            message: 'Database Error: Failed to Update Invoice.',
        };
    }
    // Revalidate cache at side client and redirect.
    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}

// DELETE INVOICE
export async function deleteInvoice(id: string) {

    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
    } catch (e) {
        return {
            message: 'Database Error: Failed to Delete Invoice.',
        };
    }

    revalidatePath('/dashboard/invoices');
}


