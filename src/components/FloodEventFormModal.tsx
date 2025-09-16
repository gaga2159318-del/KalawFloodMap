import React, { useState } from 'react';
import './FloodEventFormModal.css';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FirebaseError } from 'firebase/app';

interface FloodEventService {
  saveFloodEvent: (event: any) => Promise<string>;
}

interface FloodEventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  area: any;
  firebaseService: FloodEventService;
}

const FloodEventFormModal: React.FC<FloodEventFormModalProps> = ({ isOpen, onClose, area, firebaseService }) => {
  const [formData, setFormData] = useState({
    dateTime: new Date().toISOString().slice(0, 16),
    waterLevel: '',
    rainfallAmount: '',
    duration: '',
    floodExtent: '',
    floodImpact: '',
    weatherConditions: '',
    warningsIssued: '',
    reporterName: '',
    reporterContact: '',
    reporterOrganization: '',
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setPhotos(files);
      const previews = files.map(file => URL.createObjectURL(file));
      setPhotoPreviews(previews);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!area || !area.id) {
      console.error("Cannot submit flood event without a selected area.");
      return;
    }
    console.log('Submitting flood event', {
      area: { id: area.id, name: area.name },
      formData,
      photoCount: photos.length,
    });
    try {
      const photoURLs = await Promise.all(
        photos.map(async (photo) => {
          const photoRef = ref(storage, `flood_photos/${area.id}_${photo.name}`);
          await uploadBytes(photoRef, photo);
          return await getDownloadURL(photoRef);
        })
      );

      await firebaseService.saveFloodEvent({
        areaId: area.id,
        areaName: area.name,
        ...formData,
        photoURLs,
        timestamp: new Date().toISOString(),
      });

      onClose();
    } catch (error: unknown) {
      if (error instanceof FirebaseError) {
        console.error('FirebaseError during submit:', {
          code: error.code,
          message: error.message,
          name: error.name,
          customData: (error as any).customData,
        });
      } else {
        console.error('Unknown error during submit:', error);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`flood-event-form-modal ${isOpen ? 'active' : ''}`}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Report Flood Event for {area?.name}</h2>
          <button onClick={onClose} className="close-button">&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="dateTime">Date & Time</label>
              <input type="datetime-local" id="dateTime" name="dateTime" value={formData.dateTime} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="waterLevel">Water Level (e.g., meters)</label>
              <input type="text" id="waterLevel" name="waterLevel" placeholder="e.g., 1.5m" onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="rainfallAmount">Rainfall Amount (mm)</label>
              <input type="text" id="rainfallAmount" name="rainfallAmount" placeholder="e.g., 50mm" onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="duration">Duration (e.g., hours)</label>
              <input type="text" id="duration" name="duration" placeholder="e.g., 3 hours" onChange={handleChange} />
            </div>
            <div className="form-group full-width">
              <label htmlFor="floodExtent">Extent of Flooding</label>
              <textarea id="floodExtent" name="floodExtent" placeholder="Describe the area covered by the flood" onChange={handleChange} />
            </div>
            <div className="form-group full-width">
              <label htmlFor="floodImpact">Impact of Flooding</label>
              <textarea id="floodImpact" name="floodImpact" placeholder="Describe the impact on people and property" onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="weatherConditions">Weather Conditions</label>
              <input type="text" id="weatherConditions" name="weatherConditions" placeholder="e.g., Heavy rain, strong winds" onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="warningsIssued">Warnings Issued</label>
              <input type="text" id="warningsIssued" name="warningsIssued" placeholder="e.g., PAGASA Orange Warning" onChange={handleChange} />
            </div>
            <div className="form-group full-width">
              <label>Photos</label>
              <div className="photo-upload-area" onClick={() => document.getElementById('photo-input')?.click()}>
                <input type="file" id="photo-input" multiple onChange={handlePhotoChange} style={{ display: 'none' }} />
                <p>Click to upload photos</p>
              </div>
              <div className="photo-preview">
                {photoPreviews.map((preview, index) => (
                  <img key={index} src={preview} alt="Photo preview" />
                ))}
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="reporterName">Your Name</label>
              <input type="text" id="reporterName" name="reporterName" placeholder="Optional" onChange={handleChange} />
            </div>
            <div className="form-group">
              <label htmlFor="reporterContact">Your Contact</label>
              <input type="text" id="reporterContact" name="reporterContact" placeholder="Optional" onChange={handleChange} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" onClick={onClose} className="cancel-button">Cancel</button>
            <button type="submit" className="submit-button">Submit Report</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FloodEventFormModal;