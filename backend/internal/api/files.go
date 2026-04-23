package api

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"nodetalk/backend/internal/auth"
	"nodetalk/backend/internal/storage"
	"github.com/google/uuid"
)

// ---- Files ----------------------------------------------------------------- //

// UploadFile handles encrypted binary uploads.
func (h *Handler) UploadFile(w http.ResponseWriter, r *http.Request) {
	session := auth.SessionFromContext(r.Context())

	// Limit upload size
	maxBytes := int64(h.MaxFileSizeMB) << 20
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)

	if err := r.ParseMultipartForm(maxBytes); err != nil {
		writeError(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("file too large (max %dMB)", h.MaxFileSizeMB))
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing file in multipart form")
		return
	}
	defer file.Close()

	fileID := uuid.New().String()
	storagePath, size, err := h.Storage.Save(fileID, file)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save file")
		return
	}

	thumbCipher, _ := base64.StdEncoding.DecodeString(r.FormValue("thumb_ciphertext"))
	thumbNonce, _ := base64.StdEncoding.DecodeString(r.FormValue("thumb_nonce"))

	f, err := h.Store.RegisterFile(session.UserID, header.Header.Get("Content-Type"), storagePath, size, thumbCipher, thumbNonce)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to register file metadata")
		return
	}

	writeJSON(w, http.StatusCreated, f)
}

// DownloadFile retrieves raw encrypted bytes.
func (h *Handler) DownloadFile(w http.ResponseWriter, r *http.Request) {
	fileID := r.PathValue("id")
	f, err := h.Store.GetFile(fileID)
	if err != nil {
		writeError(w, http.StatusNotFound, "file not found")
		return
	}

	rc, err := h.Storage.Open(f.StoragePath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to open file storage")
		return
	}
	defer rc.Close()

	if _, ok := h.Storage.(*storage.FileSystemStorage); ok {
		http.ServeFile(w, r, f.StoragePath)
		return
	}

	w.Header().Set("Content-Type", f.MIMEType)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", f.SizeBytes))
	io.Copy(w, rc)
}
