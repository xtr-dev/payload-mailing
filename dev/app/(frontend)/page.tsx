import { Metadata } from 'next'
import {redirect} from "next/navigation.js"

export const metadata: Metadata = {
  title: 'PayloadCMS Mailing Plugin - Development',
  description: 'Development environment for PayloadCMS Mailing Plugin',
}

export default function HomePage() {
  redirect('/dashboard')
}
