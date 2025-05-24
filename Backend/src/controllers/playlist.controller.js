import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        throw new ApiError(400, "Playlist name is required");
    }

    const playlist = new Playlist({
        name,
        description,
        user: req.user._id, // Assuming user is attached to the request
    });

    await playlist.save();

    res.status(201).json(new ApiResponse(201, "Playlist created successfully", playlist));

    //TODO: create playlist
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    //TODO: get user playlists
    if(!isValidObjectId(userId)){
        throw new ApiError(400, "Invalid user ID")
    }
    const playlists = await Playlist.find({ user: userId});

    res.status(200)
    .json(new ApiResponse(200, {playlists}, "User playlists retrieved successfully"))
})

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    //TODO: get playlist by id
    if(!isValidObjectId(playlistId)){
        throw new ApiError(400, "Invalid user ID")
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    res.status(200).json(new ApiResponse(200, "Playlist retrieved successfully", playlist));
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist or video ID");
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if(playlist.videos.includes(videoId)){
        throw new ApiError(400, "video already exist");
    }

    playlist.videos.push(videoId); // adding video to playlist
    
    await playlist.save();
    res.status(200)
    .json(new ApiResponse(200, {playlist}, "Video added to playlist successfully"));
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    // TODO: remove video from playlist
    if(!isValidObjectId(playlistId) || !isValidObjectId(videoId)){
        throw new ApiError(400, "invalid playlist or videoId")
    }
    const playlist = await Playlist.findById(playlistId);

    if(!playlist){
        throw new ApiError(400, "playlist not found");
    }
    const videoIndex = await playlist.videos.indexOf(videoId)
    if(videoIndex === -1){
        throw new ApiError(400, "video not found in the playlist")
    }
    playlist.videos.splice(videoIndex,1);
    await playlist.save();

    res.status(200)
    .json(new ApiResponse(200, {}, "video removed successfully"))

})

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    // TODO: delete playlist
    if(!isValidObjectId(playlistId)){
        throw new ApiError(400, "invalid playlist")
    }
    const playlist = await Playlist.findByIdAndDelete(playlistId);
    
    if(!playlist){
        throw new ApiError(400, "playlist not found");
    }

    res.status(200).json(new ApiResponse(200, null, "Playlist deleted successfully"));
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    //TODO: update playlist
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    if(name) playlist.name = name;
    if(description) playlist.description = description;

    res.status(200).json(new ApiResponse(200, playlist ,"Playlist updated successfully"));
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}