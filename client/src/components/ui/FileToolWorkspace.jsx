import { useId, useState } from 'react';
import ToolIcon from './ToolIcon';

const formatSize = (bytes) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
};

export default function FileToolWorkspace({
  navTo,
  icon,
  title,
  description,
  accept,
  acceptedLabel,
  dropLabel,
  multiple = true,
  minFiles = 1,
  endpoint,
  actionLabel,
  resultTitle,
  resultDescription,
  downloadLabel,
  resetLabel,
  filterDroppedFiles,
  multiResult = false,
}) {
  const inputId = useId();
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const addFiles = (incoming) => {
    const incomingFiles = Array.from(incoming);
    const nextFiles = filterDroppedFiles
      ? filterDroppedFiles(incomingFiles)
      : incomingFiles;
    if (nextFiles.length === 0) {
      setError(`Only ${acceptedLabel} files are supported.`);
      return;
    }
    setFiles((current) => multiple ? [...current, ...nextFiles] : [nextFiles[0]]);
    setResult(null);
    setError('');
  };

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(event.type === 'dragenter' || event.type === 'dragover');
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const handleSubmit = async () => {
    if (files.length < minFiles) {
      setError(minFiles === 2
        ? `Please select at least 2 ${acceptedLabel} files.`
        : `Please select at least one ${acceptedLabel} file.`);
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (requestError) {
      setError(requestError.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const download = (downloadUrl) => {
    const apiUrl = import.meta.env.VITE_API_URL || '';
    window.location.assign((downloadUrl.startsWith('http') ? '' : apiUrl) + downloadUrl);
  };

  return (
    <main className="tool-page file-tool-page">
      <button className="back-btn" type="button" onClick={() => navTo('tool')}>
        <ToolIcon name="arrow" size={17} className="icon-back" />
        Back to tools
      </button>

      <header className="tool-header workspace-heading">
        <span className="workspace-heading-icon"><ToolIcon name={icon} size={28} /></span>
        <div>
          <h1 className="tool-title">{title}</h1>
          <p className="tool-subtitle">{description}</p>
        </div>
      </header>

      <section className="workspace-card" aria-labelledby={`${inputId}-upload-title`}>
        {!result ? (
          <>
            <div className="workspace-card-heading">
              <div>
                <h2 id={`${inputId}-upload-title`}>Add your files</h2>
                <p>{acceptedLabel} files only. Files are processed in the order shown.</p>
              </div>
              <span className="file-guidance"><ToolIcon name="info" size={17} />{acceptedLabel}</span>
            </div>

            <div
              className={`dropzone ${isDragging ? 'active' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <span className="dropzone-icon"><ToolIcon name="upload" size={30} /></span>
              <div className="dropzone-text">{isDragging ? 'Drop files here' : dropLabel}</div>
              <div className="dropzone-sub">or</div>
              <label className="btn-secondary file-picker-button" htmlFor={inputId}>Browse files</label>
              <input
                className="visually-hidden"
                id={inputId}
                type="file"
                accept={accept}
                multiple={multiple}
                onChange={(event) => addFiles(event.target.files)}
              />
              <div className="dropzone-sub">Accepted: {accept.split(',').join(', ')}</div>
            </div>

            {files.length > 0 ? (
              <div className="selected-files" aria-live="polite">
                <div className="selected-files-heading">
                  <h3>{files.length} file{files.length === 1 ? '' : 's'} selected</h3>
                  <span>Output order</span>
                </div>
                <ol className="file-list">
                  {files.map((file, index) => (
                    <li className="file-selected" key={`${file.name}-${file.size}-${index}`}>
                      <span className="file-order" aria-hidden="true">{index + 1}</span>
                      <span className="file-type-icon"><ToolIcon name={icon} size={18} /></span>
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{formatSize(file.size)}</span>
                      <button
                        className="file-remove"
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <ToolIcon name="close" size={17} />
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {error ? <div className="inline-message error" role="alert"><ToolIcon name="alert" size={19} /><span>{error}</span></div> : null}

            <div className="workspace-actions">
              <button className="btn-primary" type="button" onClick={handleSubmit} disabled={loading || files.length < minFiles}>
                {loading ? <><span className="spinner compact" />Processing…</> : <>{actionLabel}<ToolIcon name="arrow" size={18} /></>}
              </button>
              <p>{minFiles === 2 ? 'Select at least two files to continue.' : 'Select a file to continue.'}</p>
            </div>
          </>
        ) : (
          <div className="status-center success-state" role="status">
            <span className="status-icon success"><ToolIcon name="check" size={30} /></span>
            <h2 className="status-title">{resultTitle}</h2>
            <p className="status-sub">{resultDescription}</p>
            {multiResult ? (
              <div className="download-list">
                {result.files.map((resultFile, index) => (
                  <div className="download-row" key={`${resultFile.originalName}-${index}`}>
                    <span><ToolIcon name="file" size={18} />{resultFile.originalName}</span>
                    <button className="btn-download" type="button" onClick={() => download(resultFile.downloadUrl)}>
                      <ToolIcon name="download" size={17} />Download
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button className="btn-download" type="button" onClick={() => download(result.downloadUrl)}>
                <ToolIcon name="download" size={18} />{downloadLabel}
              </button>
            )}
            <button className="btn-secondary" type="button" onClick={() => { setResult(null); setFiles([]); setError(''); }}>
              {resetLabel}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
