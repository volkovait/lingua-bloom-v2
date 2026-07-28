import { redirect } from 'next/navigation'

/** Старый путь upload — основная страница чата теперь на /. */
export default function UploadRedirectPage() {
  redirect('/')
}
