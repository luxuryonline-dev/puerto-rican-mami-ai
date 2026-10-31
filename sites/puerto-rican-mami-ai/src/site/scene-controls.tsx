import { SCENE_DESCRIPTION_LIMIT, type SceneMode } from './scene';

const options = [
  { mode: 'original', title: 'Keep original scene', hint: 'Use the setting from the dance reference.' },
  { mode: 'description', title: 'Describe a new scene', hint: 'Choose a place, atmosphere and lighting.' },
  { mode: 'photo', title: 'Use a background photo', hint: 'Bring the dance into your own setting.' },
] as const;

interface Props {
  mode: SceneMode;
  description: string;
  background: string;
  disabled: boolean;
  uploading: boolean;
  onMode: (mode: SceneMode) => void;
  onDescription: (value: string) => void;
  onUpload: (file: File | undefined) => void;
  onRemove: () => void;
}

export function SceneControls(props: Props) {
  return <fieldset className="scene-controls" disabled={props.disabled}>
    <legend>Your scene</legend>
    <div className="scene-options">
      {options.map(option => <label className="scene-option" key={option.mode}>
        <input type="radio" name="scene-mode" value={option.mode} checked={props.mode === option.mode} onChange={() => props.onMode(option.mode)} />
        <span><strong>{option.title}</strong><small>{option.hint}</small></span>
      </label>)}
    </div>
    {props.mode === 'photo' && <div className="background-upload">
      <label className={`drop-zone background-drop ${props.background ? 'has-photo' : ''}`}
        onDragOver={event => event.preventDefault()}
        onDrop={event => { event.preventDefault(); if (!props.disabled) props.onUpload(event.dataTransfer.files[0]); }}>
        <input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Upload background photo"
          onChange={event => { props.onUpload(event.target.files?.[0]); event.target.value = ''; }} />
        {props.background ? <><img src={props.background} alt="Selected scene background" /><span className="change-photo">Click to replace background</span></>
          : <><strong>{props.uploading ? 'Uploading background...' : 'Add a background photo'}</strong><span>JPG, PNG or WebP �� up to 10 MB</span></>}
      </label>
      {props.background && <button type="button" className="text-button remove-background" onClick={props.onRemove}>Remove background</button>}
      <p className="input-hint">Use a photo of the setting with room to dance. People in this photo are not used as dancer references.</p>
    </div>}
    {props.mode !== 'original' && <div className="scene-description">
      <label htmlFor="scene-description">{props.mode === 'description' ? 'Describe your setting' : 'Scene details (optional)'}</label>
      <textarea id="scene-description" rows={3} value={props.description} maxLength={SCENE_DESCRIPTION_LIMIT}
        required={props.mode === 'description'} aria-describedby="scene-description-hint" placeholder={props.mode === 'description'
          ? 'A sunlit rooftop in San Juan, pastel buildings, warm golden-hour light, open dance floor.'
          : 'For example: warm evening light, keeping the space open for the dancers.'}
        onChange={event => props.onDescription(event.target.value)} />
      <div className="scene-description-meta"><p id="scene-description-hint">Describe the place and lighting. The reference still guides the dance and sound.</p><span>{props.description.length}/{SCENE_DESCRIPTION_LIMIT}</span></div>
    </div>}
    <p className="input-hint">{props.mode === 'original' ? 'The original scene is kept by default.' : 'AI reimagines the setting. Background details, movement and sound may vary.'}</p>
  </fieldset>;
}
