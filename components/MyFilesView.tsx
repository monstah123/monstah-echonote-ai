
import React from 'react';
import { Note } from '../types';
import { FileText, PlusCircle, Trash2 } from 'lucide-react';

interface MyFilesViewProps {
  notes: Note[];
  onSelectNote: (note: Note) => void;
  onRequestDelete: (noteId: number) => void;
  onNewNote: () => void;
}

const MyFilesView: React.FC<MyFilesViewProps> = ({ notes, onSelectNote, onRequestDelete, onNewNote }) => {
  
  const handleDelete = (e: React.MouseEvent, noteId: number) => {
    e.stopPropagation(); // Prevent triggering onSelectNote
    onRequestDelete(noteId);
  };

  return (
    <div className="flex flex-col h-full">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">My Files</h1>
        <p className="text-light-text-secondary dark:dark-text-secondary">You have {notes.length} note{notes.length !== 1 && 's'}.</p>
      </header>
      
      {notes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-light-text-secondary dark:dark-text-secondary">
          <FileText size={48} className="mb-4" />
          <h2 className="text-xl font-semibold">No notes yet</h2>
          <p className="mb-4">Tap the plus button to start a new note.</p>
          <button 
            onClick={onNewNote} 
            className="flex items-center gap-2 bg-brand-blue text-white py-2 px-4 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            <PlusCircle size={20} />
            Create Note
          </button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 -mr-4 pr-4">
          {[...notes].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map(note => (
            <div 
              key={note.id} 
              onClick={() => onSelectNote(note)}
              className="bg-light-card dark:bg-dark-card p-4 rounded-xl cursor-pointer hover:shadow-lg dark:hover:bg-slate-800 transition-all duration-200 group"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-light-text dark:text-dark-text truncate pr-2">{note.title}</h3>
                  <p className="text-sm text-light-text-secondary dark:dark-text-secondary mt-1">
                    {new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(note.createdAt)}
                  </p>
                </div>
                <button 
                  onClick={(e) => handleDelete(e, note.id)}
                  className="p-2 rounded-full text-light-text-secondary dark:text-dark-text-secondary hover:bg-red-100 dark:hover:bg-red-900/50 hover:text-red-600 dark:hover:text-red-400 opacity-50 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete note"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              {note.summary && (
                <p className="text-sm text-light-text-secondary dark:dark-text-secondary mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 line-clamp-2">
                  {note.summary}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyFilesView;
