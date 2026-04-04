import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
    title: 'PDF to CSV Converter',
    description: 'Convert PDF files to CSV format with bulk upload and editing capabilities',
    viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
            <head>
                <meta charSet="utf-8" />
                <meta name="theme-color" content="#0d9488" />
            </head>
            <body className="bg-gray-900 text-gray-100">
                {children}
            </body>
        </html>
    )
}