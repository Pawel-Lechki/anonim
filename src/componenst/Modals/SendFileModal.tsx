import { Button, Form, Modal } from "react-bootstrap"
import { useForm } from "react-hook-form"

interface SendFileModalProps {
  isOpen: boolean
  onClose: () => void
  pdfBlob: Blob | null
}

interface FormData {
  name: string
  pesel: string
}

const SendFileModal = ({ isOpen, onClose, pdfBlob }: SendFileModalProps) => {
  // console.log("pdfBlob", pdfBlob)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>()
  const onSubmit = async (data: FormData) => {
    if (!pdfBlob) return
    const formData = new FormData()
    formData.append("name", data.name)
    formData.append("pesel", data.pesel)
    formData.append("file", pdfBlob, "file.pdf")
    console.log("formData", formData)
    // Tutaj możesz wysłać dane do serwera lub wykonać inne operacje
    await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })

    onClose()
  }
  return (
    <Modal show={isOpen} onHide={onClose}>
      <Form onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header closeButton>
          <Modal.Title>Wypenij dane</Modal.Title>
        </Modal.Header>
        {!pdfBlob ? (
          <>
            <Modal.Body>
              <p>Blad wczytywania pliku PDF</p>
            </Modal.Body>
            <Modal.Footer>
              <Button onClick={() => onClose()}>Zamknij</Button>
            </Modal.Footer>
          </>
        ) : (
          <>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Control
                  type="text"
                  placeholder="Imię"
                  {...register("name")}
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Control
                  type="text"
                  placeholder="PESEL"
                  {...register("pesel")}
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button onClick={() => onClose()}>Anuluj</Button>
              <Button type="submit">Wyślij</Button>
            </Modal.Footer>
          </>
        )}
      </Form>
    </Modal>
  )
}

export default SendFileModal
