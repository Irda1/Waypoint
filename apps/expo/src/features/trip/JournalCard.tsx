import React, { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, Text as RNText, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Button, ErrorNote, Text } from '../../ui';
import { Icon } from '../../ui/Icon';
import { FadeImage } from '../../ui/motion';
import { useTheme } from '../../theme/useTheme';
import { fonts, radius, space } from '../../theme/tokens';
import { formatDay } from '../../lib/format';
import { MAX_PHOTOS, addPhoto, deletePhoto, saveNote } from '../../data/journal';
import type { Journal, JournalPhoto } from '../../data/journal';
import type { Member } from '../../data/useTrip';

type Reloadable = Journal & { reload: () => void };

function names(ids: (string | null | undefined)[], members: Member[]): string {
  const list = [...new Set(ids.filter((x): x is string => !!x))]
    .map((id) => members.find((m) => m.user_id === id)?.profiles?.display_name)
    .filter((n): n is string => !!n);
  return list.length <= 1 ? list.join('') : `${list.slice(0, -1).join(', ')} et ${list[list.length - 1]}`;
}

/** Une photo en grand, avec son auteur ; on ne supprime que les siennes. */
function PhotoViewer({ photo, members, userId, onClose, onDeleted }: { photo: JournalPhoto | null; members: Member[]; userId: string | null; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!photo) return null;
  const by = names([photo.created_by], members);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(7,9,11,0.94)', justifyContent: 'center', padding: space.lg, gap: space.md }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer la photo" onPress={onClose}
          style={{ position: 'absolute', top: space.xl, right: space.lg, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)', zIndex: 2 }}>
          <Icon name="close" size={20} color="#fff" />
        </Pressable>
        {photo.url ? <Image source={{ uri: photo.url }} accessibilityIgnoresInvertColors resizeMode="contain" style={{ width: '100%', flex: 1, maxHeight: '80%' }} /> : null}
        <RNText style={{ fontFamily: fonts.sans, fontSize: 13, color: '#B3B9BB', textAlign: 'center' }}>{by ? `Photo de ${by}` : 'Photo du carnet'}</RNText>
        <ErrorNote message={error} />
        {photo.created_by && photo.created_by === userId ? (
          <Button label="Supprimer ma photo" variant="ghost" icon="trash" loading={busy} onPress={async () => {
            setBusy(true);
            const err = await deletePhoto(photo);
            setBusy(false);
            if (err) { setError(err); return; }
            onDeleted();
          }} />
        ) : null}
      </View>
    </Modal>
  );
}

/** « Carnet du jour » : une note commune, enregistrée toute seule, et jusqu'à 12 photos. */
export function JournalCard({ tripId, dayId, journal, members, userId }: { tripId: string; dayId: string; journal: Reloadable; members: Member[]; userId: string | null }) {
  const { colors } = useTheme();
  const saved = journal.notes.get(dayId);
  const [text, setText] = useState(saved?.note ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(0);
  const [open, setOpen] = useState<JournalPhoto | null>(null);
  const dirty = useRef(false);
  const latest = useRef(text);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La note d'un autre membre arrive au rechargement, sauf pendant qu'on écrit.
  useEffect(() => { if (!dirty.current) setText(saved?.note ?? ''); }, [saved?.note, dayId]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!journal.available) return null;
  const photos = journal.photos.filter((p) => p.day_id === dayId);

  const onChange = (value: string) => {
    setText(value);
    latest.current = value;
    dirty.current = true;
    setStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const err = await saveNote(tripId, dayId, value);
      if (latest.current === value) dirty.current = false;   // rien tapé depuis : la note en base est à jour
      setError(err ? 'Note non enregistrée (connexion ?). Elle sera renvoyée à la prochaine modification.' : null);
      setStatus(err ? 'idle' : 'saved');
    }, 900);
  };

  const pick = async () => {
    setError(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, exif: false, allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length });
    if (res.canceled) return;
    const assets = res.assets.slice(0, MAX_PHOTOS - photos.length);
    setUploading(assets.length);
    for (const a of assets) {
      const err = await addPhoto(tripId, dayId, a);
      setUploading((n) => n - 1);
      if (err) { setError(err); break; }
    }
    setUploading(0);
    journal.reload();
  };

  const by = names([saved?.created_by, saved?.updated_by, ...photos.map((p) => p.created_by)], members);
  return (
    <View style={{ gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Icon name="book" size={18} />
        <Text variant="heading" style={{ flex: 1, fontSize: 18 }}>Carnet du jour</Text>
        <Text variant="muted" style={{ fontSize: 12 }} accessibilityLiveRegion="polite">{status === 'saving' ? 'Enregistrement…' : status === 'saved' ? 'Enregistré' : ''}</Text>
      </View>
      <TextInput value={text} onChangeText={onChange} multiline maxLength={5000} accessibilityLabel="Note du jour"
        placeholder="Ce qu'on retient de la journée…" placeholderTextColor={colors.text3}
        style={{ minHeight: 72, padding: space.md, borderRadius: radius.field, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line, color: colors.text, fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, textAlignVertical: 'top' }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {photos.map((p) => (
          <Pressable key={p.id} accessibilityRole="imagebutton" accessibilityLabel="Ouvrir la photo" onPress={() => setOpen(p)} style={{ width: '23.5%', aspectRatio: 1 }}>
            <FadeImage uri={p.url} style={{ width: '100%', height: '100%', borderRadius: 10, backgroundColor: colors.surface2 }}>
              <Icon name="image" size={18} tone="muted" />
            </FadeImage>
          </Pressable>
        ))}
        {Array.from({ length: uploading }, (_, i) => (
          <View key={`u${i}`} style={{ width: '23.5%', aspectRatio: 1 }}><FadeImage uri={undefined} style={{ width: '100%', height: '100%', borderRadius: 10, backgroundColor: colors.surface2 }} /></View>
        ))}
        {photos.length + uploading < MAX_PHOTOS ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Ajouter des photos" disabled={uploading > 0} onPress={pick}
            style={{ width: '23.5%', aspectRatio: 1, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
            <Icon name="add" size={18} />
            <RNText style={{ fontFamily: fonts.sansSemi, fontSize: 12, color: colors.text2 }}>Photo</RNText>
          </Pressable>
        ) : null}
      </View>
      <Text variant="muted" style={{ fontSize: 12 }}>{[by ? `Écrit par ${by}` : null, `${photos.length} photo${photos.length > 1 ? 's' : ''} sur ${MAX_PHOTOS}`].filter(Boolean).join(' · ')}</Text>
      <ErrorNote message={error} />
      <PhotoViewer photo={open} members={members} userId={userId} onClose={() => setOpen(null)} onDeleted={() => { setOpen(null); journal.reload(); }} />
    </View>
  );
}

/** Section « Carnet » de l'onglet Voyage : un résumé par jour écrit, et tout le carnet à lire d'un trait. */
export function JournalSection({ journal, days, cityName }: { journal: Reloadable; days: { id: string; day_date: string; city_id: number | null }[]; cityName: (cityId: number | null) => string }) {
  const { colors } = useTheme();
  const [reading, setReading] = useState(false);
  if (!journal.available) return null;
  const written = days.map((d, i) => ({ d, i, note: journal.notes.get(d.id)?.note.trim() ?? '', photos: journal.photos.filter((p) => p.day_id === d.id) }))
    .filter((x) => x.note || x.photos.length);
  const total = journal.photos.length;
  if (!written.length) return <Text variant="muted">Le carnet se remplit depuis l'onglet Jour : une note et des photos par journée.</Text>;
  return (
    <View style={{ gap: space.md }}>
      <Text variant="muted">{written.length} jour{written.length > 1 ? 's' : ''} écrit{written.length > 1 ? 's' : ''} · {total} photo{total > 1 ? 's' : ''}</Text>
      {written.slice(0, 4).map(({ d, i, note, photos }) => (
        <View key={d.id} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
          <FadeImage uri={photos[0]?.url ?? null} style={{ width: 56, height: 56, borderRadius: 12, backgroundColor: colors.surface2 }}>
            <Icon name="book" size={20} tone="muted" />
          </FadeImage>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="body" style={{ fontFamily: fonts.sansSemi }}>Jour {i + 1} · {cityName(d.city_id) || formatDay(d.day_date)}</Text>
            {note ? <Text variant="muted" numberOfLines={2}>{note}</Text> : <Text variant="muted">{photos.length} photo{photos.length > 1 ? 's' : ''}</Text>}
          </View>
        </View>
      ))}
      <Button label="Lire tout le carnet" icon="book" variant="ghost" onPress={() => setReading(true)} />
      <Modal visible={reading} animationType="slide" onRequestClose={() => setReading(false)}>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <ScrollView contentContainerStyle={{ padding: space.lg, paddingTop: space.xl, gap: space.xl, maxWidth: 720, width: '100%', alignSelf: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text variant="title" style={{ flex: 1 }}>Carnet</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Fermer le carnet" onPress={() => setReading(false)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={22} tone="text" />
              </Pressable>
            </View>
            {written.map(({ d, i, note, photos }) => (
              <View key={d.id} style={{ gap: space.sm }}>
                <Text variant="label" style={{ color: colors.accent }}>Jour {i + 1} · {formatDay(d.day_date)}</Text>
                <Text variant="heading">{cityName(d.city_id) || `Jour ${i + 1}`}</Text>
                {note ? <Text variant="body">{note}</Text> : null}
                {photos.map((p) => (
                  <FadeImage key={p.id} uri={p.url} style={{ width: '100%', aspectRatio: p.width && p.height ? p.width / p.height : 4 / 3, borderRadius: 14, backgroundColor: colors.surface2 }} />
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
