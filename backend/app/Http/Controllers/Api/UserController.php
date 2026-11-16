<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class UserController extends Controller
{
    /** GET /api/users?search=: personas con las que se puede iniciar un chat */
    public function index(Request $request): AnonymousResourceCollection
    {
        $search = mb_substr(trim((string) $request->query('search', '')), 0, 60);

        $users = User::query()
            ->whereKeyNot($request->user()->id)
            ->when($search !== '', function ($q) use ($search) {
                $like = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $search).'%';
                $q->where(fn ($w) => $w->where('name', 'like', $like)->orWhere('email', 'like', $like));
            })
            ->orderBy('name')
            ->limit(20)
            ->get();

        return UserResource::collection($users);
    }
}
