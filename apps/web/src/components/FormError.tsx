interface FormErrorProps {
  message: string | null
  extra?: string[]
}

export function FormError({ message, extra = [] }: FormErrorProps) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
    >
      <p>{message}</p>
      {extra.length > 0 && (
        <ul className="mt-1 list-disc pl-5">
          {extra.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
